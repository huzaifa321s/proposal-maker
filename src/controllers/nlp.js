// src/controllers/nlp.js
import axios from "axios";
import TokenPool from "../models/TokenPool.js";


/**
 * extractBusinessInfo – IT & Digital Services Proposal Maker
 * Returns structured JSON with recommended services + count
*/
// Production-Ready Business Info Extraction with Groq
// Enhanced with retry logic, circuit breaker, and fallbacks

export async function extractBusinessInfo(polishedText) {
  const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_KEY) {
    console.warn("⚠️ GROQ_API_KEY missing. Skipping extraction.");
    return { error: "GROQ_API_KEY missing" };
  }

  const prompt = `
You are a senior proposal strategist at Humantek, a premium digital agency.

CRITICAL JSON FORMATTING RULES:
- Return ONLY pure flat JSON. Nothing else.
- NEVER use actual line breaks inside JSON string values
- For multi-line fields, use \\n (escaped newline) instead of actual newlines
- Example CORRECT: "pain_points": "• Issue 1\\n• Issue 2\\n• Issue 3"
- Example WRONG: "pain_points": "• Issue 1
  • Issue 2"
- All string values must be on a single line with \\n for line breaks
- NEVER add trailing commas
- Response MUST be valid JSON that passes JSON.parse()

INSTRUCTIONS (FOLLOW 100%):
- Extract with perfect accuracy ONLY from the transcript provided below.
- NEVER use any previous client data (especially never assume Trendfumes or any past brand).
- Every field must have its matching _prompt field with refinement suggestions.
- RETURN VALID PURE JSON ONLY.
- NEVER wrap JSON inside quotes, never escape it, and never return it as a string.
- NEVER add extra curly braces, backticks, or markdown.
- The response MUST be RAW JSON only, directly starting with { and ending with }.
- If any field is empty, still output valid JSON.

CRITICAL _PROMPT FIELD RULES:
- NEVER put reasons for empty fields in _prompt fields
- _prompt fields should ALWAYS contain AI-generated suggestions to IMPROVE or REFINE the extracted data
- Each _prompt should be unique and contextual to its field
- _prompt should guide the user on how to enhance/expand that specific field
- Examples:
  ✅ CORRECT: "brand_name_prompt": "Consider adding a memorable tagline that reflects your brand's personality"
  ✅ CORRECT: "goals_prompt": "Break down your goals into specific, measurable objectives with timelines"
  ✅ CORRECT: "deliverables_prompt": "Add detailed specifications for each deliverable (dimensions, formats, revisions)"
  ❌ WRONG: "brand_name_prompt": "No brand name was mentioned in the transcript"
  ❌ WRONG: "goals_prompt": "Client did not specify goals"

- For deliverables → return as ARRAY OF OBJECTS with this structure:
  [
    {
      "item": "Posters",
      "estimated_time": "7-10 working days"
    },
    {
      "item": "Banners",
      "estimated_time": "5-7 working days"
    }
  ]
- For quotation → return as ARRAY OF OBJECTS with this structure:
  [
    {
      "item": "Posters",
      "quantity": 15,
      "estimated_cost_pkr": 22500
    },
    {
      "item": "Banners",
      "quantity": 3,
      "estimated_cost_pkr": 6000
    }
  ]

- If nothing mentioned → use null, "", or [] BUT still provide helpful _prompt
- If no business info at all → return only: { "info_message": "No extractable business information found in this transcript." }

RETURN EXACTLY THIS JSON STRUCTURE:
{
  "brand_name": "",
  "brand_name_prompt": "Suggest ways to strengthen brand identity with a memorable name that reflects the business values",
  "brand_tagline": "",
  "brand_tagline_prompt": "Recommend creating a compelling tagline that captures the brand essence in 5-10 words",
  "business_details": "",
  "business_details_prompt": "Expand on business model, unique selling points, and what makes this business stand out",
  "business_type": "",
  "business_type_prompt": "Clarify the business category (B2B, B2C, service-based, product-based) for better positioning",
  "industry": "",
  "industry_prompt": "Define the industry vertical and sub-categories to identify competitive landscape",
  "industry_title": "",
  "industry_title_prompt": "Create a professional industry designation that positions the business strategically",
  "target_audience": "",
  "target_audience_prompt": "Develop detailed buyer personas including demographics, psychographics, and pain points",
  "goals": "",
  "goals_prompt": "Break down goals into SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound)",
  "pain_points": "",
  "pain_points_prompt": "Identify 3-5 core challenges the business faces and prioritize by impact and urgency",
  "deliverables": [
    {
      "item": "",
      "estimated_time": ""
    }
  ],
  "deliverables_prompt": "Add technical specifications, file formats, revision rounds, and approval milestones for each deliverable",
  "quotation": [
    {
      "item": "",
      "quantity": 0,
      "estimated_cost_pkr": 0
    }
  ],
  "quotation_prompt": "Include itemized breakdown with unit costs, volume discounts, and payment milestone structure",
  "design_direction": "",
  "design_direction_prompt": "Define visual style guide including color psychology, typography hierarchy, and brand mood board references",
  "why_choose_HT": "",
  "why_choose_HT_prompt": "Highlight Humantek's unique differentiators, case studies, and ROI metrics from past projects",
  "next_steps": "",
  "next_steps_prompt": "Create a detailed roadmap with specific dates, deliverables, review cycles, and approval gates",
  "recommended_services": [],
  "recommended_services_prompt": "Suggest complementary services that could enhance project outcomes and long-term value",
  "num_services": 0,
  "num_services_prompt": "Recommend optimal service package size based on business stage and budget considerations",
  "project_brief": "",
  "project_brief_prompt": "Develop a comprehensive brief covering background, challenges, proposed solution, and success metrics",
  "objectives": "",
  "objectives_prompt": "Define measurable KPIs for each objective with baseline metrics and target improvements",
  "proposed_solution": "",
  "proposed_solution_prompt": "Detail the implementation strategy, technology stack, timeline phases, and resource allocation"
}

EXTRACTION RULES FOR TABLES:

1. DELIVERABLES TABLE (Timeline):
   - Extract all mentioned deliverable items (Posters, Banners, Animated Videos, etc.)
   - For each item, find:
     * item: exact name from transcript
     * estimated_time: time mentioned (e.g., "7-10 working days", "12-14 working days")
   - If no time mentioned, estimate based on industry standards
   - If NO deliverables found, return empty array [] but provide helpful deliverables_prompt

2. QUOTATION TABLE (Pricing):
   - Extract pricing information for each deliverable
   - For each item, find:
     * item: exact deliverable name (must match deliverables table)
     * quantity: number of items mentioned
     * estimated_cost_pkr: cost in PKR
   - If pricing not mentioned, use empty array [] but provide helpful quotation_prompt

3. MATCHING RULE:
   - Deliverable items and quotation items MUST match exactly
   - If quotation mentioned for "Posters", deliverables must also have "Posters"
   - Keep item names consistent across both tables

FORMATTING RULES FOR MULTI-LINE FIELDS (USE \\n NOT ACTUAL NEWLINES):

1. PAIN POINTS:
   Use \\n between bullet points:
   "• Problem 1\\n• Problem 2\\n• Problem 3"

2. NEXT STEPS:
   Use \\n between numbered items:
   "1. Step one\\n2. Step two\\n3. Step three"

3. OBJECTIVES:
   Use \\n between objectives:
   "• Objective 1\\n• Objective 2\\n• Objective 3"

4. DESIGN DIRECTION:
   Use \\n for structure:
   "• Style: Premium and modern\\n• Colors: Brand palette\\n• Format:\\n  ○ Posters: PNG\\n  ○ Videos: MP4"

5. WHY CHOOSE HUMANTEK:
   Use \\n between reasons:
   "• Reason 1\\n• Reason 2\\n• Reason 3"

6. PROJECT BRIEF & PROPOSED SOLUTION:
   Keep as single paragraph or use \\n between sentences

REMEMBER FOR _PROMPT FIELDS:
- Always provide actionable suggestions, NEVER just state what's missing
- Make each _prompt unique and contextual to that specific field
- Think like a consultant helping the client improve their proposal
- Generate different helpful suggestions each time this is called
- Examples of GOOD _prompts:
  * "Consider conducting a competitive analysis to position your brand uniquely in the market"
  * "Interview 5-10 target customers to validate assumptions and refine messaging"
  * "Create a phased rollout plan with clear success metrics for each milestone"

NOW EXTRACT ONLY FROM THIS TRANSCRIPT:
${polishedText}

Return pure JSON immediately with all fields properly formatted as specified above. Remember: Use \\n for line breaks, NOT actual newlines! And make sure _prompt fields contain helpful AI-generated suggestions, not reasons for missing data!
`;

  const headers = {
    Authorization: `Bearer ${GROQ_KEY}`,
    "Content-Type": "application/json",
  };

  const body = {
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 4000,
  };

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 Groq API attempt ${attempt + 1}/${MAX_RETRIES}`);

      const resp = await axios.post(GROQ_API, body, {
        headers,
        timeout: 60000
      });

      let raw = resp.data?.choices?.[0]?.message?.content || "";

      if (!raw) {
        throw new Error('Empty response from Groq API');
      }

      raw = raw.replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const firstObjMatch = raw.match(/\{[\s\S]*\}/);
      if (!firstObjMatch) {
        throw new Error('No JSON object found in response');
      }

      let jsonStr = firstObjMatch[0];

      jsonStr = jsonStr.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      });

      try {
        const parsed = JSON.parse(jsonStr);

        // --- TRACK USAGE ---
        try {
          const pool = await TokenPool.getPool();
          const usage = resp.data.usage;
          if (usage) {
            const tokensUsed = usage.total_tokens || 0;
            pool.usedGroqTokens += tokensUsed;
            pool.usageHistory.push({
              tokensUsed,
              type: 'groq',
              details: JSON.stringify({ feat: 'extract_info', model: resp.data.model })
            });
            await pool.save();
          }
        } catch (poolErr) {
          console.error("Failed to update token pool in extractBusinessInfo:", poolErr.message);
        }
        // --- END USAGE ---

        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
          console.log('✅ Groq extraction successful (array flattened)');
          return parsed[0];
        }

        console.log('✅ Groq extraction successful');
        return parsed;

      } catch (parseErr) {
        console.error('❌ JSON parse failed:', parseErr.message);
        console.log('Attempted JSON (first 500 chars):', jsonStr.substring(0, 500));

        if (attempt === MAX_RETRIES - 1) {
          return {
            error: "Invalid JSON from Groq",
            raw: jsonStr.substring(0, 500),
            parse_error: parseErr.message
          };
        }

        throw new Error(`JSON parse error: ${parseErr.message}`);
      }

    } catch (err) {
      console.error(`❌ Groq attempt ${attempt + 1} failed:`, err.message);

      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);

        if (err.response.status === 429) {
          console.warn('⚠️ Rate limit hit! Consider upgrading plan.');
        }

        if (err.response.status === 401) {
          console.error('🚨 Authentication failed! Check GROQ_API_KEY.');
          return { error: "Invalid API key", details: "Check GROQ_API_KEY" };
        }
      }

      if (attempt === MAX_RETRIES - 1) {
        console.error('🚨 All Groq retry attempts exhausted');
        return {
          error: "Request failed after retries",
          details: err.message,
          attempts: MAX_RETRIES,
          last_error: err.response?.data || err.message
        };
      }

      const delay = RETRY_DELAYS[attempt];
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    error: "Unexpected failure",
    details: "All retry attempts failed"
  };
}

// Health check function for monitoring
export async function checkGroqHealth() {
  const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_KEY) {
    return { healthy: false, reason: 'API key missing' };
  }

  try {
    const resp = await axios.post(
      GROQ_API,
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "health check" }],
        max_tokens: 10
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    return {
      healthy: true,
      latency: resp.duration || 'N/A',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      healthy: false,
      reason: err.message,
      status_code: err.response?.status,
      timestamp: new Date().toISOString()
    };
  }
}

export async function refineField(field, currentValue, userPrompt, context = {}) {
  const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_KEY = process.env.GROQ_API_KEY;

  const headers = {
    Authorization: `Bearer ${GROQ_KEY}`,
    "Content-Type": "application/json",
  };

  // Detect field type and set appropriate formatting instructions
  const getFieldFormatting = (fieldName, currentVal) => {
    // Check if it's an array field (deliverables or quotation)
    if (fieldName === "deliverables") {
      return {
        type: "array_of_objects",
        structure: `[
  {
    "item": "Item name",

    "estimated_time": "Time range"
  }
]`,
        instruction: "Return as an ARRAY OF OBJECTS with keys: item, estimated_time. Maintain exact same structure."
      };
    }

    if (fieldName === "quotation") {
      return {
        type: "array_of_objects",
        structure: `[
  {
    "item": "Item name",
    "quantity": 0,
    "estimated_cost_pkr": 0
  }
]`,
        instruction: "Return as an ARRAY OF OBJECTS with keys: item, quantity, estimated_cost_pkr. Maintain exact same structure."
      };
    }

    // Check for bulleted text fields
    if (fieldName === "design_direction") {
      return {
        type: "bulleted_structured",
        example: `• Style: Premium, elegant, and modern
• Colors: Brand palette details
• Format:
  ○ Posters: JPEG/PNG
  ○ Videos: MP4`,
        instruction: "Return as bulleted text with • bullets covering Style, Colors, and Format sections. Use ○ for sub-bullets under Format."
      };
    }

    if (fieldName === "objectives") {
      return {
        type: "bulleted",
        example: "• First objective\n• Second objective\n• Third objective",
        instruction: "Return as bulleted list with • bullets. Each objective on new line starting with •"
      };
    }

    if (fieldName === "why_choose_HT") {
      return {
        type: "bulleted",
        example: "• Proven expertise in branding\n• Timely delivery with revisions\n• Dedicated project management",
        instruction: "Return as bulleted list with • bullets. Each reason on new line starting with •"
      };
    }

    if (fieldName === "next_steps") {
      return {
        type: "numbered_bullets",
        example: "1. Confirm requirements\n2. Share brand assets\n3. Begin design process\n4. Review and delivery",
        instruction: "Return as numbered list with format: '1. ', '2. ', etc. Each step on new line."
      };
    }

    if (fieldName === "pain_points" || fieldName === "project_brief" || fieldName === "proposed_solution") {
      return {
        type: "bulleted_paragraph",
        example: "• First pain point description\n• Second challenge\n• Third issue",
        instruction: "Return as 2-3 lines with bullet points (•). Short paragraph format with bullets."
      };
    }

    // Check if current value has bullets
    if (typeof currentVal === "string" && currentVal.includes("•")) {
      return {
        type: "bulleted",
        instruction: "Return as bulleted text with • bullets. Keep same bullet format as current value."
      };
    }

    // Check if current value has numbered list
    if (typeof currentVal === "string" && /^\d+\./.test(currentVal.trim())) {
      return {
        type: "numbered_bullets",
        instruction: "Return as numbered list with format: '1. ', '2. ', etc."
      };
    }

    // Default to plain text
    return {
      type: "plain_text",
      instruction: "Return as plain text without any special formatting."
    };
  };

  const formatting = getFieldFormatting(field, currentValue);

  // Enhanced system prompt with field-specific formatting awareness
  const systemPrompt = `You are an expert at refining business proposal fields with strong understanding of both English and Roman Urdu (Urdu written in Latin script).

LANGUAGE UNDERSTANDING:
- Roman Urdu examples: "mujhe", "proposal", "company ka naam", "project details", "budget kitna hai"
- Understand mixed language: "Company ka description update karo"
- Common Roman Urdu words: ka, ke, ki, hai, ho, karo, likhdo, batao, chahiye, etc.
- Respond in the SAME language as the user's instruction or the provided transcript context.
- If the instruction is in Roman Urdu, the response should be in Roman Urdu or the appropriate language requested.

FIELD TYPE FORMATTING - THIS IS CRITICAL:
Current field type: ${formatting.type}
${formatting.structure ? `Expected structure:\n${formatting.structure}` : ""}
${formatting.example ? `Example format:\n${formatting.example}` : ""}

FORMATTING INSTRUCTION:
${formatting.instruction}

TASK:
- Refine the specified field based on user's instruction
- Use full transcript and context for accuracy
- **MAINTAIN THE EXACT FORMATTING TYPE** (${formatting.type})
- If user instruction is in Roman Urdu, understand it naturally
- Keep professional tone and original structure intent

RESPONSE FORMAT:
Return ONLY valid JSON:
{
  "updatedValue": ${formatting.type === "array_of_objects" ? "[...]" : '"..."'}
}

CRITICAL:
- For array fields (deliverables, quotation): updatedValue MUST be an array of objects
- For bulleted fields: updatedValue MUST be a string with • bullets
- For numbered fields: updatedValue MUST be a string with numbered format
- For plain text: updatedValue is a plain string

Do not include explanations, just the JSON object.`;

  const userMessage = `Field to refine: "${field}"
Field type: ${formatting.type}

Current value:
${typeof currentValue === "object" ? JSON.stringify(currentValue, null, 2) : currentValue || "N/A"}

User's refinement instruction: "${userPrompt}"

Context from full transcript (may contain English/Roman Urdu):
${context.fullTranscript ? context.fullTranscript.slice(0, 5000) : "N/A"}

Additional context:
${context.proposalType ? `Proposal type: ${context.proposalType}` : ""}
${context.companyName ? `Company: ${context.companyName}` : ""}

IMPORTANT: Return the refined content in the EXACT SAME FORMAT TYPE as the current value.
${formatting.type === "array_of_objects" ? "Return as array of objects, NOT as string." : ""}
${formatting.type === "bulleted" || formatting.type === "bulleted_paragraph" || formatting.type === "bulleted_structured" ? "Return as string with • bullets." : ""}
${formatting.type === "numbered_bullets" ? "Return as string with numbered format (1. 2. 3.)." : ""}`;

  const body = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 1200, // Increased for longer array responses
    top_p: 0.9,
    response_format: { type: "json_object" },
  };

  try {
    const resp = await axios.post(GROQ_API, body, { headers, timeout: 40000 });
    const content = resp.data?.choices?.[0]?.message?.content?.trim();

    // Clean and parse JSON
    const cleaned = content.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);

      // Validate response structure
      if (parsed.updatedValue !== undefined) {
        // --- TRACK USAGE ---
        try {
          const pool = await TokenPool.getPool();
          const usage = resp.data.usage;
          if (usage) {
            const tokensUsed = usage.total_tokens || 0;
            pool.usedGroqTokens += tokensUsed;
            pool.usageHistory.push({
              tokensUsed,
              type: 'groq',
              details: JSON.stringify({ feat: 'refine_field', field, model: resp.data.model })
            });
            await pool.save();
          }
        } catch (poolErr) {
          console.error("Failed to update token pool in refineField:", poolErr.message);
        }
        // --- END USAGE ---
        // Additional validation for array types
        if (formatting.type === "array_of_objects" && !Array.isArray(parsed.updatedValue)) {
          console.warn(`Expected array for ${field}, got:`, typeof parsed.updatedValue);
          // Try to parse if it's a stringified array
          if (typeof parsed.updatedValue === "string") {
            try {
              const arrayValue = JSON.parse(parsed.updatedValue);
              if (Array.isArray(arrayValue)) {
                return { updatedValue: arrayValue };
              }
            } catch (e) {
              console.error("Failed to parse array from string");
            }
          }
        }

        return parsed;
      } else {
        console.warn("Unexpected JSON structure:", parsed);
        return { updatedValue: content };
      }
    } catch (jsonErr) {
      console.warn("JSON parse failed, returning raw string:", cleaned);
      return { updatedValue: cleaned };
    }
  } catch (err) {
    console.error("Refine error:", err.response?.data || err.message);
    return {
      error: "Refinement failed",
      details: err.response?.data?.error?.message || err.message,
    };
  }
}

