// src/services/assemblyService.js
import axios from "axios";
import fs from "fs";

const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";

/**
 * Step 1: Return file path
 */
export async function uploadToAssemblyAI(filePath) {
  console.log("File ready for Deepgram:", filePath);
  if (!fs.existsSync(filePath)) throw new Error("File not found: " + filePath);
  return filePath;
}

/**
 * Step 2: Urdu Audio → Roman Urdu (Auto-detect + Diarization)
 */
export async function transcribeAudio(filePath, sendProgress) {
  const DG_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DG_KEY) throw new Error("Missing DEEPGRAM_API_KEY");

  if (!fs.existsSync(filePath)) throw new Error("File not found: " + filePath);
  sendProgress("transcription_status", { status: "Transcription Started" });
  try {
    console.log("Sending to Deepgram (Auto-detect Urdu → Roman Urdu)...");

    const response = await axios({
      method: "POST",
      url: DEEPGRAM_API,
      headers: {
        Authorization: `Token ${DG_KEY}`,
        "Content-Type": "audio/*",
      },
      params: {
        model: "nova-2",           // Only supported model
        // language: "ur",         // ← REMOVE (not supported)
        diarize: true,             // Speaker labels
        smart_format: true,        // Punctuation, numbers
        // translate: true,        // ← NOT SUPPORTED
      },
      data: fs.createReadStream(filePath),
      maxBodyLength: Infinity,
      timeout: 300000,
    });
    sendProgress("transcription_status", { status: "Transcripting..." });
    const result = response.data.results;
    let romanUrduText = "";

    if (result?.utterances?.length > 0) {
      result.utterances.forEach((u) => {
        romanUrduText += `\nSpeaker ${u.speaker}: ${u.transcript}`;
      });
    } else {
      const alt = result?.channels?.[0]?.alternatives?.[0];
      romanUrduText = alt?.transcript || "No speech detected.";
    }

    console.log("Deepgram SUCCESS! (Auto-detected Urdu → Roman Urdu)");
    console.log(romanUrduText.trim());
    sendProgress("transcription_status", { status: "Transcripting..." });
    return {
      text: romanUrduText.trim(),
      raw: response.data,
    };
  } catch (error) {
    console.error("Deepgram Error:", error.response?.data || error.message);
    throw error;
  }
}

