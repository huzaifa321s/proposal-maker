import express from 'express';
import { formatContent } from '../controllers/aiController.js';
import { generateProposalContent } from '../controllers/openaiController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = express.Router();

// POST /api/ai/smart-format
router.post('/smart-format', authenticateToken, formatContent);

// POST /api/ai/generate-proposal
router.post('/generate-proposal', authenticateToken, generateProposalContent);

export default router;
