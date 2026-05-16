// src/routes/proposal.js

import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { checkClientEmail, createProposal, deleteProposal, getAllProposals, getProposal, getSingleProposal, resetPage1, resetPage2, resetPage3, resetPagesOrder, resetPricingPage, resetTermsPage, saveProposal, updateProposal } from "../controllers/proposal.js";
import proposal from "../models/proposal.js";
import { authenticateToken, requireRole } from "../middleware/authenticateToken.js";
import { fileURLToPath } from "url";
import { put } from '@vercel/blob';
// CORRECT IMPORTS (middleware se)


const router = express.Router();

// Existing routes
router.post('/create-proposal', createProposal);
router.get('/get-all-proposals', getAllProposals);
router.get('/check-email', checkClientEmail);
router.get('/get-single-proposal/:id', getSingleProposal);
router.put('/update-proposal/:id', updateProposal);
router.delete('/delete-proposal/:id', deleteProposal);
router.post("/save", saveProposal);
// routes/proposalRoutes.js
router.get("/get/:id", getProposal);
router.post("/pages/reset/:userId", resetPage3);
router.post("/pages/reset/page2/:userId", resetPage2);
router.post("/pages/reset/paymentTermsPage/:userId", resetTermsPage);
router.post("/pages/reset/pricing/:userId", resetPricingPage);
router.post("/pages/reset/page1/:userId", resetPage1);
router.post("/pages/reset/all_pages_order/:userId", resetPagesOrder);

// fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});


router.post("/upload-pdf", upload.single("pdfFile"), async (req, res) => {
  try {
    const { proposalId } = req.body;
    if (!req.file || !proposalId) {
      return res.status(400).json({
        success: false,
        message: "PDF file and proposalId are required",
      });
    }

    // ✅ Upload to Vercel Blob
    const fileName = `pdfs/${proposalId}-${Date.now()}-${req.file.originalname}`;
    const blob = await put(fileName, req.file.buffer, {
      access: "public",
      contentType: req.file.mimetype,
    });

    // ✅ Save Blob URL in database
    await proposal.findByIdAndUpdate(proposalId, { pdfPath: blob.url });

    return res.status(200).json({
      success: true,
      message: "PDF uploaded successfully",
      filePath: blob.url,
    });
  } catch (err) {
    console.error("PDF upload error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ADMIN DASHBOARD APIs (FIXED)
router.get("/total-proposals", async (req, res) => {
  try {
    const count = await proposal.countDocuments({});
    return res.json({ success: true, data: count });
  } catch (error) {
    console.error("Error fetching total proposals:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



export default router;