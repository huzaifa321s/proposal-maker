// src/controllers/nlp.js
import axios from "axios";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

/**
 * extractBusinessInfo – IT & Digital Services Proposal Maker
 * Returns structured JSON with recommended services + count
 */
export async function extractBusinessInfo(polishedText) {
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_KEY) {
    console.warn("Warning: GROQ_API_KEY missing. Skipping extraction.");
    return { error: "GROQ_API_KEY missing" };
  }

const prompt = `
You are a senior proposal strategist for a full-stack digital agency.
Our services include:

Web Development:

WordPress (themes, plugins, SEO, blogs, business sites)

Shopify (e-commerce stores, themes, apps, payments)

Custom Web Development (HTML, CSS, JavaScript – static sites, landing pages, front-end only)

Digital Services:

Content Writing (blogs, product descriptions, SEO content)

Digital Marketing (Google Ads, SEO, email campaigns)

Social Media Management (Instagram, Facebook, TikTok – posting, growth)

Video Editing (shorts, reels, ads, product videos)

Analyze the transcript and return ONLY a pure JSON object. No markdown, no explanations.

If the transcript does not contain any business-related information, respond with:
{
"info": "The transcript does not appear to contain business-related information, so no proposal insights could be extracted."
}

Otherwise, return a JSON object with the following structure:

{
"brand_name": "If mentioned, extract the client's business or brand name accurately (e.g., SQ Logistics, Urban Threads). If not mentioned, return null.",

"brand_tagline": "Generate a short, two-line tagline that captures the essence of the brand’s purpose or industry. Base it on the transcript and context. Examples:\n- For SQ Logistics → 'Fueling Logistics\nwith Digital Power'\n- For Zyric → 'Building a Premium\nStreetwear / Fashion Presence\nin Pakistan'\n- For Adourea → 'Building a Premium\nFashion Presence in Pakistan'\nIf no clear context, return null.",

"business_details": "Detailed description of the business, including what they do, how they operate, and any relevant context from the transcript.",
"business_type": "e.g., Local Cafe, E-commerce Brand, Startup SaaS",
"industry": "Identify the client's primary industry in 1–3 words (e.g., Fashion, Logistics, Healthcare).",
"industry_title": "[Industry] Presence in [Country/Region, if mentioned]",
"goals": "Main objectives discussed or implied in the transcript",
"target_audience": "Customer or market segment the client aims to reach",
"technology_preferences": ["Any tech or platform mentioned by the client"],
"pain_points": "Key challenges the client mentioned or implied",
"recommended_services": [
"Select 1–5 matching services from our list above. Be specific: e.g., 'Shopify E-commerce Store', 'WordPress Blog Setup', 'Instagram Reels Video Editing'"
],
"num_services": "Integer: length of recommended_services array (1–5)",

"project_brief": "A professional 4–6 sentence paragraph summarizing the project intent and strategy — similar in tone and structure to the example below. Must mention client name (if available), service scope, and business goals.\n\nExample:\nThis proposal outlines Humantek’s strategy to strengthen SQ Logistics’ digital presence through social media management and performance marketing. With existing pages on Facebook and Instagram, our focus will be on optimizing content, improving branding consistency, and running targeted ad campaigns. The goal is to position SQ Logistics as a trusted B2B logistics partner for FMCG, Pharma, Textile, and Corporate sectors across 18–20 major cities (primarily Punjab & Sindh).",

"objectives": [
"List 4–6 specific objectives in bullet format, as in the example:\n- Optimize and manage existing Facebook & Instagram pages.\n- Create a consistent corporate content style.\n- Develop 12–15 monthly branded posts.\n- Run performance-driven ad campaigns."
],

"strategic_proposal": {
"Social Media Management": [
"4–5 actionable bullet points as per transcript context"
],
"Performance Marketing": [
"4–5 actionable bullet points"
],
"Branding Consistency": [
"3–5 actionable bullet points"
]
},

"proposed_solution": "Based entirely on the business context and recommended_services.\n\nExact format:\nCore Problem Identification: [2 sentences max].\n\nA 5-Point Actionable Solution Plan:\n1. [Step]\n2. [Step]\n3. [Step]\n4. [Step]\n5. [Step]\n\nRecommended Development Platforms & Tech Stack: [3–4 items: e.g., Shopify, Klaviyo, Canva]"
}

Rules:

Only generate project_brief, objectives, and strategic_proposal if business_details are meaningful.

Do not invent unrelated data — use only transcript context.

Keep JSON clean, valid, and parsable.

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
    max_tokens: 1800,
  };

  try {
    const resp = await axios.post(GROQ_API, body, { headers, timeout: 60000 });
    let raw = resp.data?.choices?.[0]?.message?.content || "";

    raw = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^[\s\n]*|[\s\n]*$/g, "")
      .trim();

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let jsonStr = raw;
    if (start !== -1 && end !== -1 && end > start) {
      jsonStr = raw.slice(start, end + 1);
    }

    try {
      return JSON.parse(jsonStr);
    } catch (err) {
      console.warn("Primary parse failed:", err.message);
      const fallback = jsonStr.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
      try {
        return JSON.parse(fallback);
      } catch (e2) {
        console.error("Fallback failed:", e2.message);
        return { error: "Invalid JSON", raw, attempted: jsonStr };
      }
    }
  } catch (err) {
    console.error("Groq error:", err.response?.data || err.message);
    return { error: "Request failed", details: err.message };
  }
}