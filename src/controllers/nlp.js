// src/controllers/nlp.js
import axios from "axios";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

/**
 * extractBusinessInfo (Groq version)
 * Uses Groq + Llama 3.1 to extract structured business info
 * Returns pure JSON only
 */
export async function extractBusinessInfo(polishedText) {
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_KEY) {
    console.warn("Warning: GROQ_API_KEY missing. Skipping business extraction.");
    return { error: "GROQ_API_KEY missing" };
  }

  const prompt = `
You are a professional business analyst.
Analyze the transcript below and return ONLY a pure JSON object.
Do NOT include any markdown, code fences, or explanations.
JSON must exactly have:
{
  "business_details": "",
  "business_type": "",
  "goals": "",
  "target_audience": "",
  "technology_preferences": [],
  "pain_points": "",
  "proposed_solution": ""
}

Transcript:
${polishedText}
`;

  const headers = {
    Authorization: `Bearer ${GROQ_KEY}`,
    "Content-Type": "application/json",
  };

  const body = {
    model: "openai/gpt-oss-120b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1200,
  };

  try {
    const resp = await axios.post(GROQ_API, body, { headers, timeout: 60000 });
    let raw = resp.data?.choices?.[0]?.message?.content || "";

    // Clean markdown, code fences, extra whitespace
    raw = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^[\s\n]*|[\s\n]*$/g, "")
      .trim();

    // Extract JSON block safely
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let jsonStr = raw;
    if (start !== -1 && end !== -1 && end > start) {
      jsonStr = raw.slice(start, end + 1);
    }

    // Parse JSON with fallbacks
    try {
      return JSON.parse(jsonStr);
    } catch (err) {
      console.warn("Primary parse failed:", err.message);

      const fallback = jsonStr
        .replace(/[\r\n]+/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      try {
        return JSON.parse(fallback);
      } catch (e2) {
        console.error("Fallback parse failed:", e2.message);
        return {
          error: "Invalid JSON from Groq",
          raw: raw,
          attempted: jsonStr,
        };
      }
    }
  } catch (err) {
    console.error("Groq extraction error:", err.response?.data || err.message);
    return { error: "Request failed", details: err.message };
  }
}