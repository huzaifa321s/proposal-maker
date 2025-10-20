import express from "express";
import { createProposal } from "../controllers/proposal.js";
const router = express.Router();

router.post('/create-proposal',createProposal)


export default router