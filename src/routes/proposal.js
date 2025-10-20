import express from "express";
import { createProposal, deleteProposal, getAllProposals, getSingleProposal, updateProposal } from "../controllers/proposal.js";
const router = express.Router();
router.post('/create-proposal',createProposal)
router.get('/get-all-proposals',getAllProposals)
router.get('/get-single-proposal/:id',getSingleProposal)
router.put('/update-proposal/:id',updateProposal)
router.delete('/delete-proposal/:id',deleteProposal)


export default router