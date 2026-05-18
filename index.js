// server.js (or index.js)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import { Server } from 'socket.io';
import Pusher from 'pusher';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/auth.js'
import profileRoutes from './src/routes/profile.js';
import proposalRoutes from './src/routes/proposal.js';
import bdmRoutes from './src/routes/bdm.js';
import transcribeRoute from './src/routes/transcribe.js';
import usageRoutes from './src/routes/usage.js';
import aiRoutes from './src/routes/ai.js';
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

import FormData from 'form-data';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { initSSE, sendSSE } from './src/utils/sse.js';
import { extractBusinessInfo } from './src/controllers/nlp.js';
import { polishWithLLM, translateWithLLM, livePolishWithLLM } from './src/controllers/llm.js';
import { authenticateToken, requireRole } from './src/middleware/authenticateToken.js';
import path from 'path';
import axios from 'axios'

// Middleware
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));
app.use(express.static('public'));
app.use("/uploads", express.static("uploads"));

// Connect Database
connectDB();

// Pusher Config
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});



// === SSE Route ===
app.get('/stream', (req, res) => {
  initSSE(req, res);
  sendSSE('status', { message: 'Connected. Ready to listen...', loading: false });
});

// === Socket.io Setup ===
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
});


// Production-Ready Socket Handler with Deepgram + Groq
// Enhanced with monitoring, circuit breaker, and fallbacks



io.on('connection', (socket) => {
  console.log('Socket.IO Client connected:', socket.id);

  const sendStatus = (message, loading = false) => {
    socket.emit('status', { message, loading });
    sendSSE('status', { message, loading });
  };

  socket.on('live_polish', async ({ text }) => {
    if (!text || text.trim().length === 0) return;
    try {
      const refined = await livePolishWithLLM(text);
      socket.emit('live_polished_text', { text: refined });
    } catch (err) {
      console.error('Live Polish Socket Error:', err);
    }
  });

  socket.on('process_transcript', async ({ transcript }) => {
    if (!transcript || transcript.trim().length === 0) {
      return sendStatus('Empty transcript received.', false);
    }

    console.log(`Processing transcript (${transcript.length} chars)...`);
    let fullPolishedTranscript = transcript;

    // Polish
    sendSSE('pipeline_status', { step: 'Polishing transcript...' });
    try {
      const polished = await polishWithLLM(fullPolishedTranscript, (type, data) => sendStatus(data.step, true));
      fullPolishedTranscript = polished;
    } catch (polishErr) {
      console.error('Polish error:', polishErr);
    }

    // Extract
    sendSSE('pipeline_status', { step: 'Extracting business details...' });
    let extracted = {};
    try {
      extracted = await extractBusinessInfo(fullPolishedTranscript);
      console.log('Extracted details:', extracted);
    } catch (err) {
      console.error('Extraction error:', err);
      extracted = { error: err.message };
    }

    // Translate
    sendSSE('pipeline_status', { step: 'Translating to Roman Urdu and English...' });
    let translations = { romanUrdu: fullPolishedTranscript, english: fullPolishedTranscript };
    try {
      translations = await translateWithLLM(fullPolishedTranscript, (type, data) => sendStatus(data.step, true));
    } catch (transErr) {
      console.error('Translation error:', transErr);
    }

    const isValidData = (obj, maxEmptyAllowed = 5) => {
      let emptyCount = 0;
      for (const key in obj) {
        if (key.endsWith("_prompt")) continue;
        const value = obj[key];
        const isEmpty = value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
        if (isEmpty) emptyCount++;
      }
      return emptyCount <= maxEmptyAllowed;
    };

    if (isValidData(extracted)) {
      sendSSE('complete', {
        data: {
          polished: fullPolishedTranscript?.trim(),
          romanUrdu: translations.romanUrdu,
          english: translations.english,
          extracted,
          step: 'Business Info Extracted Successfully'
        }
      });
    }

    socket.emit('finalized_transcript', {
      text: fullPolishedTranscript?.trim(),
      romanUrdu: translations.romanUrdu,
      english: translations.english,
      extracted,
      length: fullPolishedTranscript?.trim().length,
      is_final: true,
    });

    sendSSE('finalized_transcript', {
      text: fullPolishedTranscript?.trim(),
      romanUrdu: translations.romanUrdu,
      english: translations.english,
      length: fullPolishedTranscript?.trim().length,
      extracted,
      is_final: true,
    });

    sendStatus('Processing complete.', false);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
// === Routes (Role Protected) ===
app.use('/api/transcribe', transcribeRoute);
app.use('/api/tokens', usageRoutes);
app.use('/api/bdms', bdmRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', authenticateToken, profileRoutes);
app.use('/auth', authRoutes);
// Protect proposal routes — only admin & agent
app.use('/api/proposals', authenticateToken, requireRole(['admin', 'agent']), proposalRoutes);

// Protect proposal generation
app.post('/api/propose-solution', authenticateToken, requireRole(['admin', 'agent']), async (req, res) => {
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
    console.error('Proposal error:', error.message);
    res.status(500).json({ error: 'Proposal generation failed.', details: error.message });
  }
});

// === Generate Proposal Function (Unchanged) ===
async function generateProposal(details, sessionId = null) {
  if (!details) throw new Error('Business details are required.');

  if (sessionId) {
    await pusher.trigger(`session-${sessionId}`, 'proposal-generation-started', {
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
    console.error('Proposal generation failed:', error.message);
    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-error', { error: error.message });
    }
    throw error;
  }
}

// Root route
app.get('/', (req, res) => res.send('Live Transcription + Proposal API Running (Role-Protected)'));

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));