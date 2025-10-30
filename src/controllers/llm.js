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


  const maxInputTokens = 3000;
let shortTranscript = text;
if (text.length > maxInputTokens * 4) {
  shortTranscript = text.substring(0, maxInputTokens * 4) + "... [truncated]";
}

  const prompt = `
You are a professional translator, editor, and linguistic expert with strong knowledge of Roman Urdu and English.

Task:
1. Convert the Roman Urdu transcript to natural, fluent, professional English.
2. Keep speaker labels exactly as: Speaker 0, Speaker 1, etc.
3. Fix grammar, punctuation, sentence structure, and flow.
4. **Correct misspelled or phonetically written words** by replacing them with the **most likely correct English word** based on:
   - **Sound similarity** (e.g., "baje" → "o'clock", "kaha" → "said")
   - **Context** (e.g., "trafik" → "traffic", "meating" → "meeting")
   - **Common Roman Urdu patterns** (e.g., "hn" → "yes", "nhn" → "no")
5. Do **not** add, remove, or change the original meaning.
6. Output only the corrected English transcript with speaker labels.

Transcript:
${text}
Output only the cleaned English transcript with speaker labels.
Return only the final English version. No explanations.
`;


  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: "llama-3.1-8b-instant",
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