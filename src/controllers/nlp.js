import axios from "axios";

const LLM_GATEWAY = "https://llm-gateway.assemblyai.com/v1/chat/completions";


export async function extractBusinessInfo(polishedText) {
  const prompt = `
You are a professional business analyst.
Analyze the transcript below and return ONLY a pure JSON object.
Do NOT include any markdown, code fences, or explanations.
JSON must exactly have:
{
  "business_details": "",
  "business_type": "",
  "goals": "",
  "budget": "",
  "target_audience": "",
  "timeline": "",
  "technology_preferences": [],
  "pain_points": "",
  "proposed_solution": ""
}

Transcript:
${polishedText}
`;
const headers = {
  authorization: process.env.ASSEMBLYAI_API_KEY,
  "content-type": "application/json",
};
  const body = {
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1200,
  };

  try {
    const resp = await axios.post(LLM_GATEWAY, body, { headers });
    let raw = resp.data?.choices?.[0]?.message?.content || "";

    // ✅ Remove all markdown/code fence formatting before parsing
    raw = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^[\s\n]*|[\s\n]*$/g, "") // trim
      .trim();

    // ✅ Extract JSON substring safely
    const startIndex = raw.indexOf("{");
    const endIndex = raw.lastIndexOf("}");
    let clean = raw;
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      clean = raw.slice(startIndex, endIndex + 1);
    }

    // ✅ Try to parse it safely
    try {
      return JSON.parse(clean);
    } catch (err) {
      console.warn("Primary JSON parse failed:", err.message);

      // 🧠 fallback: clean common junk and retry
      const secondTry = clean
        .replace(/[\r\n]+/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      try {
        return JSON.parse(secondTry);
      } catch (e2) {
        console.error("Fallback parse failed too:", e2.message);
        return { error: "Invalid JSON from LLM", raw: raw };
      }
    }
  } catch (err) {
    console.error("NLP extraction error:", err.response?.data || err.message);
    return { error: "Request failed", details: err.message };
  }
}
