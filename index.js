// api/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Pusher from 'pusher';
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import profileRoutes from './src/routes/profile.js';
import proposalRoutes from './src/routes/proposal.js';
import transcribeRoute from './src/routes/transcribe.js';
import connectDB from './src/config/db.js';

dotenv.config();

const app = express();

// CORS 
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://your-frontend.vercel.app'], 
  credentials: true 
}));
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));

// Connect DB 
connectDB();

// Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Routes
app.use("/api/transcribe", transcribeRoute);
app.use("/api", profileRoutes);
app.use("/api/proposals", proposalRoutes);

// Test Pusher
app.get('/api/test-pusher', async (req, res) => {
  await pusher.trigger('mic-audio', 'transcript', { 
    text: 'Test from Vercel!',
    timestamp: new Date().toISOString()
  });
  res.json({ message: 'Pusher test success' });
});

// Generate Proposal (same as tera code)
async function generateProposal(details, sessionId = null) {
  // ... tera pura generateProposal function yahan paste kar
  // (main ne upar wala diya hai, same use kar)
}

// POST /api/propose-solution
app.post('/api/propose-solution', async (req, res) => {
  // ... tera pura /api/propose-solution handler
});

// Home
app.get('/', (req, res) => {
  res.send('In-House Proposal System API - Vercel Deployed!');
});

export default app; // Yeh must hai Vercel ke liye