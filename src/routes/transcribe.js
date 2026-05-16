import express from "express";
import multer from "multer";
import fs from "fs";
import { transcribeAudio, uploadToAssemblyAI, waitForTranscript } from "../controllers/assembly.js";
import { extractBusinessInfo, refineField } from "../controllers/nlp.js";
import { sendSSE, initSSE } from "../utils/sse.js";
import { polishWithLLM } from "../controllers/llm.js";
import TokenPool from "../models/TokenPool.js";
import path from "path";
const router = express.Router();
import { fileURLToPath } from "url";
import { put } from "@vercel/blob";
// __filename aur __dirname define karna
// fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});
// 🧩 Step 1: Client connects for SSE
router.get("/sse", (req, res) => {
  initSSE(req, res);
  sendSSE("connected", { message: "SSE connection established" });
});

// 🧩 Step 2: File upload triggers backend processing
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    sendSSE("upload_status", { step: "Uploading..." });
    console.log('req.file.path', filePath)
    // ✅ Upload to Vercel Blob
    const fileName = `${Date.now()}-${req.file.originalname}`; // ❌ req.file.name wrong hai
    const blob = await put(fileName, req.file.buffer, {
      access: "public",
      contentType: req.file.mimetype,
    });
    // const uploadUrl = await uploadToAssemblyAI(blob.url);
    sendSSE("upload_status", { step: "Upload complete" });

    const transcriptId = await transcribeAudio(blob.url);
    sendSSE("transcription_status", { step: "Transcription started" });

    const result = await waitForTranscript(transcriptId, sendSSE);


    let translatedText = "";
    if (result.utterances && result.utterances.length > 0) {
      result.utterances.forEach((u) => {
        // Preferred original text over translation
        translatedText += `\nSpeaker ${u.speaker}: ${u.text}`;
      });
    } else {
      // Fallback if no utterances/speaker labels
      translatedText = result.text || "Transcription completed but no text found.";
    }

    console.log('Final Raw Transcript:', translatedText);

    sendSSE("pipeline_status", { step: "Polishing transcript..." });
    const polishedText = await polishWithLLM(translatedText, sendSSE);
    console.log('Polished Transcript:', polishedText);

    sendSSE("pipeline_status", { step: "Extracting business details..." });
    const extracted = await extractBusinessInfo(polishedText);

    // ✅ Update Token Usage
    try {
      const pool = await TokenPool.getPool();
      const tokensUsed = Math.ceil(translatedText.split(/\s+/).length * 1.5); // Simple estimation
      pool.usedTokens += tokensUsed;
      pool.usageHistory.push({
        tokensUsed,
        type: "audio_to_proposal",
        details: JSON.stringify({ transcriptLength: translatedText.length })
      });
      await pool.save();
      console.log(`✅ Token pool updated: +${tokensUsed} tokens`);
    } catch (tokenErr) {
      console.error("❌ Failed to update token pool:", tokenErr.message);
    }

    sendSSE("completed_audio", { success: true, data: { polished: polishedText, extracted } });
    res.json({ message: "Processing completed and result sent via SSE." });
  } catch (err) {
    console.error("Pipeline error:", err);

    let errorMessage = err.message;
    if (err.response?.data?.error) {
      errorMessage = err.response.data.error;

      // ✅ Handle Insufficient Balance specifically
      if (errorMessage.toLowerCase().includes("balance") || errorMessage.toLowerCase().includes("top up")) {
        try {
          const pool = await TokenPool.getPool();
          pool.usedTokens = pool.totalTokens; // Force to 100% used for display
          await pool.save();
          console.log("🚨 Token pool updated to reflect empty balance");
        } catch (poolErr) {
          console.error("Failed to update pool on error:", poolErr);
        }
      }
    }

    sendSSE("error", {
      message: errorMessage,
      type: "ASSEMBLY_AI_ERROR"
    });
    res.status(err.response?.status || 500).json({ error: errorMessage });
  }
});

router.post("/ai/refine", async (req, res) => {
  try {
    console.log("🔹 Refinement API called");

    const { field, prompt, currentValue, fullTranscript } = req.body; // added fullTranscript
    console.log('field', field)
    // Pass full transcript as context
    const refined = await refineField(field, currentValue, prompt, {
      fullTranscript,
    });
    console.log('refined', refined)
    res.status(200).json({ success: true, refined });
  } catch (err) {
    console.error("❌ /ai/refine error:", err.message);
    res.status(500).json({ success: false, error: "Refinement failed" });

  }
});


router.post("/ai/extract", async (req, res) => {
  try {
    const { transcript } = req.body;
    console.log('transcript', transcript)
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Transcript is required" });
    }

    console.log("🧠 Extract request received with transcript length:", transcript.length);

    const extracted = await extractBusinessInfo(transcript);

    if (extracted.error) {
      return res.status(500).json({ error: "Extraction failed", details: extracted });
    }

    console.log("📊 Extracted:", extracted);
    res.json({ success: true, data: extracted });
  } catch (err) {
    console.error("❌ Error in /ai/extract:", err.message);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});





export default router;
