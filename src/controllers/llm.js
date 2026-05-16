// src/services/gladiaService.js
import axios from "axios";
import TokenPool from "../models/TokenPool.js";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

/**
 * polishWithLLM (Groq version)
 * Uses Groq + Llama 3.1 to polish the transcript in its ORIGINAL language.
 * Function name same rakha hai
 */
export async function polishWithLLM(text, sendProgress) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  sendProgress("llm_status", { step: "Starting transcript polish with Groq Llama 3.3..." });

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
You are a professional editor and linguistic expert specialized in South Asian languages and business communications.

Task:
1. Polish the provided transcript while maintaining its ORIGINAL language.
2. **Handle Mixed Language (Urdish/Hinglish)**: If the user speaks Urdu mixed with English words (common in business), keep both. Correct the spellings of English terms if they were transcribed phonetically.
3. If the input is primarily Roman Urdu, keep it in Roman Urdu. If it is Urdu script, keep it in Urdu script.
4. Keep speaker labels exactly as: Speaker 0, Speaker 1, etc.
5. Fix grammar, punctuation, and flow. 
6. Ensure technical or business English words (e.g., "Software", "Website", "Investment", "Proposal") are spelled correctly even if the surrounding text is Urdu.
7. Do **not** add, remove, or change the original meaning.
8. Ensure the tone is professional yet natural for a business consultation.

Transcript:
${text}
Return only the final polished version. No explanations.
`;


  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0.2,
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

    // --- TRACK USAGE ---
    try {
      const pool = await TokenPool.getPool();
      const usage = response.data.usage;
      if (usage) {
        const tokensUsed = usage.total_tokens || 0;
        pool.usedGroqTokens += tokensUsed;
        pool.usageHistory.push({
          tokensUsed,
          type: 'groq',
          details: JSON.stringify({ feat: 'live_polish', model: response.data.model })
        });
        await pool.save();
      }
    } catch (poolErr) {
      console.error("Failed to update token pool in polishWithLLM:", poolErr.message);
    }
    // --- END USAGE ---

    sendProgress("llm_status", { step: "Transcript polish complete" });
    console.log("Groq Polish SUCCESS!");
    return polished;
  } catch (err) {
    console.error("Groq LLM Error:", err.response?.data || err.message);
    sendProgress("llm_status", { step: "LLM polish failed" });
    return text; // Fallback
  }
}

/**
 * translateWithLLM
 * Translates the provided text into Roman Urdu and English using Groq Llama 3.3.
 */
export async function translateWithLLM(text, sendProgress) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return { romanUrdu: text, english: text };

  sendProgress("llm_status", { step: "Performing high-quality translation (Llama 3.3)..." });

  const prompt = `
You are a world-class translation expert specializing in Urdu, Roman Urdu, and English Business Communications.

Context: This is a transcript from a professional business consultation / proposal meeting.

Task:
1. Translate the following Urdu transcript into **Standard Roman Urdu**.
   - Use natural, readable spellings (e.g., "kaise hain" instead of "kese hen").
   - Maintain the emotional tone and business context.
2. Translate the following Urdu transcript into **Professional English**.
   - Use high-level vocabulary suitable for a business proposal.
   - Fix any conversational fillers (like "um", "uh") and make it sound eloquent.

Transcript:
${text}

Return the translations in the following JSON format ONLY:
{
  "romanUrdu": "...",
  "english": "..."
}
`;

  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    const content = JSON.parse(response.data.choices[0].message.content.trim());

    // --- TRACK USAGE ---
    try {
      const pool = await TokenPool.getPool();
      const usage = response.data.usage;
      if (usage) {
        pool.usedGroqTokens += usage.total_tokens || 0;
        await pool.save();
      }
    } catch (poolErr) {
      console.error("Failed to update token pool in translateWithLLM:", poolErr.message);
    }

    sendProgress("llm_status", { step: "High-quality Translation complete" });
    return content;
  } catch (err) {
    console.error("Groq Translation Error:", err.message);
    return { romanUrdu: text, english: text }; // Fallback
  }
}

/**
 * livePolishWithLLM
 * Fast version of polish for real-time refinement during recording.
 * Uses a faster model (8B) for snappy UI updates.
 */
export async function livePolishWithLLM(text) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) return text;

  const prompt = `
Task: Polish this live transcript segment. 
1. The user speaks Urdu mixed with English (Urdish).
2. Fix phonetic misspellings of English words (e.g., "miting" -> "meeting").
3. Preserve the original Urdu words and grammar.
4. Keep the output in the SAME script as input (Urdu script or Roman).
5. Output ONLY the polished segment. No preamble.

Segment:
${text}
`;

  try {
    const response = await axios.post(
      GROQ_API,
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const polished = response.data.choices[0].message.content.trim();

    // Usage tracking
    try {
      const pool = await TokenPool.getPool();
      const usage = response.data.usage;
      if (usage) {
        pool.usedGroqTokens += usage.total_tokens || 0;
        await pool.save();
      }
    } catch (poolErr) {
      console.error("TokenPool update fail (live):", poolErr.message);
    }

    return polished;
  } catch (err) {
    console.error("Live Polish Error:", err.message);
    return text;
  }
}
