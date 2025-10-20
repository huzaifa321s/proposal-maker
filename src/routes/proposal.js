import express from "express";
import { createProposal, getAllProposals } from "../controllers/proposal.js";
const router = express.Router();

router.post('/create-proposal',createProposal)
router.get('/get-all-proposals',getAllProposals)

export default router