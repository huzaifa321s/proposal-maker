// src/services/gladiaService.js
import axios from "axios";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

/**
 * polishWithLLM (Groq version)
 * Uses Groq + Llama 3.1 to translate Roman Urdu → Natural English + polish
 * Function name same rakha hai
 */
export async function polishWithLLM(text, sendProgress) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  sendProgress("llm_status", { step: "Starting Urdu→English translation with Groq..." });

  if (!GROQ_KEY) {
    console.warn("Warning: GROQ_API_KEY missing. Skipping polish.");
    sendProgress("llm_status", { step: "LLM polish skipped" });
    return text;
  }

  const prompt = `
You are a professional translator and editor.

Task:
1. Convert this Roman Urdu transcript to natural, fluent English.
2. Keep speaker labels (Speaker 0, Speaker 1, etc.).
3. Fix grammar, punctuation, and flow.
4. Do not add or remove meaning.

Transcript:
${text}

Output only the cleaned English transcript with speaker labels.
`;

  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: "llama-3.1-8b-instant", // ← Updated (replacement for llama3-8b-8192)
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    const polished = response.data.choices[0].message.content.trim();
    sendProgress("llm_status", { step: "Translation & polish complete" });
    console.log("Groq Polish SUCCESS!");
    return polished;
  } catch (err) {
    console.error("Groq LLM Error:", err.response?.data || err.message);
    sendProgress("llm_status", { step: "LLM polish failed" });
    return text; // Fallback
  }
}