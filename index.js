import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Pusher from 'pusher';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import connectDB from './src/config/db.js';
import profileRoutes from './src/routes/profile.js';
import proposalRoutes from './src/routes/proposal.js';
import bdmRoutes from './src/routes/bdm.js';
import transcribeRoute from './src/routes/transcribe.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));
app.use(express.static('public'));

// ✅ Connect Database
connectDB();

// ✅ Pusher Config
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// ✅ Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
});

// ✅ Deepgram Setup
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);

  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    interim_results: true,
    encoding: 'linear16',
    sample_rate: 16000,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log('🌐 Deepgram connected');
    socket.emit('status', 'connected');
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    const isFinal = data.is_final;

    if (transcript && transcript.trim() !== '') {
      console.log(isFinal ? '🗣️ FINAL:' : '💬 PARTIAL:', transcript);
      socket.emit('transcript', { text: transcript, is_final: isFinal });
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error('❌ Deepgram Error:', err);
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    console.log('🔴 Deepgram closed');
  });

  socket.on('audio_chunk', (chunk) => {
    if (connection.getReadyState() === 1) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      connection.send(buffer);
    }
  });

  socket.on('stop_recording', () => {
    console.log('🛑 Stopping');
    connection.finish();
  });

  socket.on('disconnect', () => {
    console.log('⚫ Disconnected');
    connection.finish();
  });
});

// ✅ Proposal Generator
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateProposal(details, sessionId = null) {
  if (!details) throw new Error('Business details are required.');

  if (sessionId) {
    await pusher.trigger(`session-${sessionId}`, 'proposal-generation-started', {
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: details }] }],
      generationConfig: { temperature: 0.2 },
    });

    const proposalText = result.response.text();

    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-generated', { proposal: proposalText });
    }

    return proposalText;
  } catch (error) {
    console.error('❌ Proposal generation failed:', error.message);
    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-error', { error: error.message });
    }
    throw error;
  }
}

// ✅ Routes
app.use('/api/transcribe', transcribeRoute);
app.use('/api/bdms', bdmRoutes);
app.use('/api', profileRoutes);
app.use('/api/proposals', proposalRoutes);

// ✅ Proposal API
app.post('/api/propose-solution', async (req, res) => {
  const { businessDetails, sessionId } = req.body;
  if (!businessDetails)
    return res.status(400).json({ error: "Missing 'businessDetails'." });

  try {
    const fullProposal = await generateProposal(businessDetails, sessionId);

    const marker = '3. Recommended Development Platforms & Tech Stack';
    const idx = fullProposal.indexOf(marker);

    let recommendedPlatforms = '';
    let mainSolution = fullProposal;

    if (idx !== -1) {
      const platformsText = fullProposal.substring(idx + marker.length).trim();
      recommendedPlatforms = platformsText.split('\n')[0].trim();
      mainSolution = fullProposal.substring(0, idx).trim();
    }

    const payload = {
      status: 'success',
      proposedSolution: mainSolution,
      developmentPlatforms: recommendedPlatforms || 'Not found',
      sessionId,
      timestamp: new Date().toISOString(),
    };

    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-complete', payload);
    }

    res.json(payload);
  } catch (error) {
    console.error('❌ Proposal error:', error.message);
    res.status(500).json({ error: 'Proposal generation failed.', details: error.message });
  }
});

// ✅ Root route
app.get('/', (req, res) => res.send('🚀 Live Transcription + Proposal API Running'));

// ✅ Start server
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
