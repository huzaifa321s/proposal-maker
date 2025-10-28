// src/services/llmService.js
import axios from "axios";

const LLM_GATEWAY = "https://llm-gateway.assemblyai.com/v1/chat/completions";


export async function polishWithLLM(text, sendProgress) {
  sendProgress("llm_status", { step: "Starting Urdu→English polish..." });
const headers = {
  authorization: process.env.ASSEMBLYAI_API_KEY,
  "content-type": "application/json",
};
  const prompt = `
You are a professional linguist and translator.
The following text is a transcript containing Urdu sentences written in Roman Urdu.
Translate all Urdu to fluent English.
Keep speaker labels like "Speaker 0:" and "Speaker 1:".
Fix grammar and punctuation, but do not change meaning.

Transcript:
${text}
`;

  const body = {
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.3,
  };

  try {
    const resp = await axios.post(LLM_GATEWAY, body, { headers });
    const content = resp.data.choices?.[0]?.message?.content?.trim() || "";
    sendProgress("llm_status", { step: "Polishing complete" });
    return content || text;
  } catch (err) {
    console.error("LLM polish error:", err.response?.data || err.message);
    sendProgress("llm_status", { step: "LLM polish failed" });
    return text;
  }
}
