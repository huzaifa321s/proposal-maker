import express from "express";
import multer from "multer";
import fs from "fs";
import { transcribeAudio, uploadToAssemblyAI } from "../controllers/assembly.js";
import { polishWithLLM } from "../controllers/llm.js";
import { extractBusinessInfo } from "../controllers/nlp.js";
import { sendSSE, initSSE } from "../utils/sse.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// 🧩 Step 1: Client connects for SSE
router.get("/sse", (req, res) => {
  initSSE(req, res);
  sendSSE("connected", { message: "SSE connection established" });
});

// 🧩 Step 2: File upload triggers backend processing
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    sendSSE("upload_status", { step: "Uploading to AssemblyAI..." });

    const uploadUrl = await uploadToAssemblyAI(filePath);
    sendSSE("upload_status", { step: "Upload complete" });

    const transcription = await transcribeAudio(uploadUrl, sendSSE);
    console.log('transcription', transcription)
    sendSSE("transcription_status", { status: "completed" });

    let translatedText = "";


    if (transcription.raw?.results?.utterances?.length > 0) {
      transcription.raw.results.utterances.forEach((u) => {
        translatedText += `\nSpeaker ${u.speaker}: ${u.transcript}`;
      });
    }

    else if (transcription.text) {
      translatedText = transcription.text;
    }
    // Fallback
    else {
      translatedText = "No transcript available.";
    }

    console.log("Formatted Transcript:\n", translatedText.trim());

    sendSSE("pipeline_status", { step: "Polishing transcript..." });
    const polished = await polishWithLLM(translatedText, sendSSE);
    sendSSE("pipeline_status", { step: "Extracting business details..." });
    const extracted = await extractBusinessInfo(polished);

    sendSSE("complete", { success: true, data: { polished, extracted } });
    res.json({ message: "Processing started, watch SSE for updates." });
  } catch (err) {
    console.error("Pipeline error:", err);
    sendSSE("error", { message: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
