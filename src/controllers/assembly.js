// src/services/assemblyService.js
import axios from "axios";
import fs from "fs";

const ASSEMBLY_API = "https://api.assemblyai.com/v2";


export async function uploadToAssemblyAI(filePath) {
    const headers = {
  authorization: process.env.ASSEMBLYAI_API_KEY,
  "content-type": "application/json",
};
  const response = await axios.post(
    `${ASSEMBLY_API}/upload`,
    fs.createReadStream(filePath),
    { headers: { authorization: process.env.ASSEMBLYAI_API_KEY } }
  );
  return response.data.upload_url;
}
export async function transcribeAudio(uploadUrl) {
    const headers = {
  authorization: process.env.ASSEMBLYAI_API_KEY,
  "content-type": "application/json",
};
    console.log(process.env.ASSEMBLYAI_API_KEY)
    console.log("headers",headers)
  const response = await axios.post(
    `${ASSEMBLY_API}/transcript`,
    {
      audio_url: uploadUrl,
      speaker_labels: true,
      punctuate: true,
      format_text: true,
      speech_understanding: {
        request: {
          translation: {
            target_languages: ["en"],
            formal: false,
          },
        },
      },
    },
    { headers }
  );
  return response.data.id;
}


export async function waitForTranscript(id, sendProgress) {
    const headers = {
  authorization: process.env.ASSEMBLYAI_API_KEY,
  "content-type": "application/json",
};
while (true) {
      sendProgress("pipeline_status", { step: "Transripting..." });

    const res = await axios.get(`${ASSEMBLY_API}/transcript/${id}`, { headers });
    sendProgress("transcription_status", { status: res.data.status });

    if (res.data.status === "completed") return res.data;
    if (res.data.status === "error") throw new Error(res.data.error);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
