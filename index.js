import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Pusher from 'pusher';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import http from 'http';
import {WebSocket, WebSocketServer } from 'ws';
import connectDB from './src/config/db.js';
import profileRoutes from './src/routes/profile.js';
import proposalRoutes from './src/routes/proposal.js';
import transcribeRoute from './src/routes/transcribe.js'
dotenv.config();
const app = express();
const server = http.createServer(app);

// Initialize Pusher
const pusher = new Pusher({
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Initialize Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const PORT = process.env.PORT || 5000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));
app.use(express.static('public'));
connectDB();



app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use("/api/transcribe", transcribeRoute);





// WebSocket Server for real-time audio streaming
const AAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const wss = new WebSocketServer({ server, path: '/ws/audio' });
const SPEECHMATICS_API_KEY = process.env.SPEECHMATICS_API_KEY;
const SPEECHMATICS_URL = `wss://eu2.rt.speechmatics.com/v2?auth_token=${SPEECHMATICS_API_KEY}`;
const GLADIA_API_KEY = process.env.GLADIA_API_KEY;
const GLADIA_URL = `wss://api.gladia.io/audio-transcription`;


// Test Pusher endpoint
app.get('/api/test-pusher', async (req, res) => {
  await pusher.trigger('mic-audio', 'transcript', { 
    text: 'Test transcript from server',
    timestamp: new Date().toISOString()
  });
  res.status(200).json({ status: 'success', message: 'Test event triggered' });
});

// Google Generative AI Proposal Generation
async function generateProposal(details, sessionId = null) {
  if (!details) {
    throw new Error('Business details are required.');
  }

  // Broadcast proposal generation started
  if (sessionId) {
    await pusher.trigger(`session-${sessionId}`, 'proposal-generation-started', { 
      timestamp: new Date().toISOString()
    });
  }
  await pusher.trigger('proposal-generation', 'started', { 
    sessionId: sessionId,
    timestamp: new Date().toISOString()
  });

  const systemInstruction = `You are a Senior Business Consultant, specializing in rapid deployment and cost-effective digital solutions (CMS/e-commerce). Analyze the business details, propose a concise, actionable, 5-point solution plan, and critically, **provide a short list of 3-4 recommended development platforms/technologies as ONLY comma-separated single words (e.g., WordPress, Shopify, Node.js)** suitable for the solution. The output must be highly professional and structured into three distinct sections.`;

  const userPrompt = `Analyze the following business situation and provide a detailed proposed solution. Your response must strictly follow this structure:
  1. Core Problem Identification (Max 2 sentences).
  2. A 5-Point Actionable Solution Plan (List format).
  3. Recommended Development Platforms & Tech Stack (A single line of only 3-4 comma-separated platform names/keywords, e.g., WordPress, WooCommerce, React).
  ---
  BUSINESS DETAILS:
  ${details}
  ---
  PROPOSED SOLUTION (Start directly with the title, e.g., 'Core Problem Identification'):`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const response = await result.response;
    const proposalText = response.text();
    
    // Broadcast proposal generated
    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-generated', { 
        proposal: proposalText,
        timestamp: new Date().toISOString()
      });
    }
    await pusher.trigger('proposal-generation', 'completed', { 
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    });
    
    return proposalText;
  } catch (error) {
    // Broadcast error
    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-error', { 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    await pusher.trigger('proposal-generation', 'error', { 
      error: error.message,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    });
    
    throw new Error(`Failed to generate proposal: ${error.message}`);
  }
}

app.post('/api/propose-solution', async (req, res) => {
  const { businessDetails, sessionId } = req.body;
  if (!businessDetails) {
    return res.status(400).json({ error: "Please provide 'businessDetails' in the request body." });
  }

  try {
    const fullProposal = await generateProposal(businessDetails, sessionId);
    console.log('📜 Full Proposal:', fullProposal);

    const platformsSectionMarker = '3. Recommended Development Platforms & Tech Stack';
    const platformsIndex = fullProposal.indexOf(platformsSectionMarker);

    let recommendedPlatforms = '';
    let mainSolution = fullProposal;

    if (platformsIndex !== -1) {
      const platformsText = fullProposal.substring(platformsIndex + platformsSectionMarker.length).trim();
      recommendedPlatforms = platformsText.split('\n')[0].trim();
      mainSolution = fullProposal.substring(0, platformsIndex).trim();
    } else {
      console.warn('⚠️ Could not find platforms section in the proposal');
    }

    const responsePayload = {
      status: 'success',
      proposedSolution: mainSolution,
      developmentPlatforms: recommendedPlatforms || 'Not found',
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    };

    // Broadcast final proposal via Pusher
    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-complete', responsePayload);
    }
    await pusher.trigger('proposal-generation', 'proposal-ready', responsePayload);

    res.json(responsePayload);
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    const errorPayload = { 
      error: 'Failed to generate or parse proposal.', 
      details: error.message,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast error via Pusher
    if (sessionId) {
      await pusher.trigger(`session-${sessionId}`, 'proposal-error', errorPayload);
    }
    await pusher.trigger('proposal-generation', 'error', errorPayload);
    
    res.status(500).json(errorPayload);
  }
});

app.use('/api', profileRoutes);
app.use('/api/proposals', proposalRoutes);

app.get('/', (req, res) => res.send('🚀 Server is running successfully (In-House Proposal System API)'));

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));