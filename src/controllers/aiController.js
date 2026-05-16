import Groq from 'groq-sdk';
import TokenPool from '../models/TokenPool.js';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export const formatContent = async (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ error: "Content is required" });
    }

    try {
        const pool = await TokenPool.getPool();

        // Check if Groq limit reached
        if (pool.usedGroqTokens >= pool.groqLimit) {
            return res.status(403).json({
                error: "Plan Exhausted",
                message: "Groq AI usage limit has been reached. Please upgrade your plan."
            });
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert document parser. Parse mixed content into structured JSON sections with SMART, INTELLIGENT parsing.

**OUTPUT SCHEMA (STRICT):**
{
  "sections": [
    {
      "type": "title" | "numbered" | "bullets" | "plain" | "heading",
      "title": "Section header text (can be empty string)",
      "subtitle": "Optional subtitle/subheader (can be empty string)",
      "content": "Main content body"
    }
  ]
}

**CRITICAL PARSING INTELLIGENCE RULES:**

1. **SMART TITLE vs HEADING DETECTION**
   - A header is a "title" (not "heading") if it has content immediately following it.
   - A header is a "heading" ONLY if it's a major document divider separating multiple distinct sections.
   - BAD: Every header becomes a separate "heading" section.
   - GOOD: Headers with content become the "title" field of their content section.

2. **NEVER OUTPUT THE SAME TEXT TWICE**
   - BAD: One section for title, another section for content.
   - GOOD: One merged section with title and content.

3. **ONE VISUAL BLOCK = ONE JSON OBJECT**
   - Header + Content = ONE object with that header as "title".
   - Header + List = ONE 'bullets' or 'numbered' section with header as "title".
   - Header + Paragraph = ONE 'plain' section with header as "title".

4. **SAME TITLE = SAME SECTION**
   - If multiple content blocks share the same title/header, MERGE them into ONE section.
   - Combine all content under that title into a single "content" field.
   - BAD: [{"title": "Features", "content": "Item 1"}, {"title": "Features", "content": "Item 2"}]
   - GOOD: [{"title": "Features", "content": "Item 1\\nItem 2"}]

5. **SUBTITLE DETECTION RULES:**
   - If two headers appear consecutively before content: First is "title", Second is "subtitle".
   - Subtitle goes in "subtitle" field, NOT in title or content.

6. **STRICT MERGING RULES:**
   - Header + List → ONE 'bullets' or 'numbered' section.
   - Header + Paragraph → ONE 'plain' section.
   - Multiple content blocks with same header → ONE section with combined content.

**SECTION TYPE DEFINITIONS:**

**TYPE: 'bullets' (HIGHEST PRIORITY)**
- Use when content has bullet markers (-, *, •, etc.) or is clearly a list.
- The header above the list goes in "title" field.
- Format: { "type": "bullets", "title": "List Header", "subtitle": "", "content": "• Item 1\\n• Item 2" }

**TYPE: 'numbered'**
- Use when content has numbered markers (1., 2., etc.).
- The header above the numbered list goes in "title" field.
- Format: { "type": "numbered", "title": "Steps Header", "subtitle": "", "content": "1. Step 1\\n2. Step 2" }

**TYPE: 'plain'**
- Use when content is a paragraph or regular text.
- The header above the paragraph goes in "title" field.
- Format: { "type": "plain", "title": "Section Header", "subtitle": "", "content": "Paragraph text here." }

**TYPE: 'heading' (USE SPARINGLY)**
- Use ONLY for major document dividers that separate large sections with NO immediate content.
- Think of it as a chapter heading or part divider in a book.
- MUST have multiple distinct sections following it.
- Format: { "type": "heading", "title": "PART I: Introduction", "subtitle": "", "content": "" }
- Example use case: "Chapter 1", "Section A", "Part II" when they divide the document into major parts.

**TYPE: 'title' (DEPRECATED - AVOID)**
- Almost never use this. Headers should be the "title" field of their content section.

**INTELLIGENT PARSING EXAMPLES:**

Input:
"Features
- Fast processing
- Easy to use"

Output:
{ "sections": [ { "type": "bullets", "title": "Features", "subtitle": "", "content": "• Fast processing\\n• Easy to use" } ] }

Input:
"Installation Steps
1. Download the package
2. Run installer"

Output:
{ "sections": [ { "type": "numbered", "title": "Installation Steps", "subtitle": "", "content": "1. Download the package\\n2. Run installer" } ] }

Input:
"Introduction
This document covers the basics.

Setup
Follow these steps carefully."

Output:
{ "sections": [ 
  { "type": "plain", "title": "Introduction", "subtitle": "", "content": "This document covers the basics." },
  { "type": "plain", "title": "Setup", "subtitle": "", "content": "Follow these steps carefully." }
] }

Input:
"CHAPTER 1: GETTING STARTED

Welcome Section
This is the welcome text.

Installation
Here are the steps."

Output:
{ "sections": [ 
  { "type": "heading", "title": "CHAPTER 1: GETTING STARTED", "subtitle": "", "content": "" },
  { "type": "plain", "title": "Welcome Section", "subtitle": "", "content": "This is the welcome text." },
  { "type": "plain", "title": "Installation", "subtitle": "", "content": "Here are the steps." }
] }

**CLEANING RULES:**
1. Convert all bullet markers (-, *, etc.) to "•".
2. Remove Markdown formatting (**bold**, *italic*).
3. Ensure every section has a "subtitle" field (empty string if none).
4. Merge all sections with identical titles into one section.
5. Use "heading" type ONLY for major document dividers.

**FINAL CHECK BEFORE OUTPUT:**
- Did I make a header into a separate "heading" when it should be the "title" of its content? FIX IT.
- Are there any duplicate sections with the same title? MERGE THEM.
- Is every header properly associated with its content? VERIFY IT.

Return ONLY valid JSON with NO additional text.`
                },
                {
                    role: "user",
                    content: `Parse this content into sections:\n\n${content}`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.05,
            response_format: { type: "json_object" }
        });

        const jsonResponse = JSON.parse(completion.choices[0]?.message?.content || "{}");

        // --- TRACK USAGE ---
        const usage = completion.usage;
        if (usage) {
            const tokensUsed = usage.total_tokens || 0;
            pool.usedGroqTokens += tokensUsed;

            pool.usageHistory.push({
                tokensUsed: tokensUsed,
                type: 'groq',
                userEmail: req.user?.email || 'anonymous',
                userId: req.user?.id || null,
                details: JSON.stringify({ model: completion.model, usage })
            });

            const usagePercent = (pool.usedGroqTokens / pool.groqLimit) * 100;
            if (usagePercent >= 95 && (!pool.lastGroqAlert?.groq95 || (Date.now() - new Date(pool.lastGroqAlert.groq95).getTime() > 24 * 60 * 60 * 1000))) {
                pool.notifications.push({
                    type: 'alert',
                    title: 'Groq Usage Critical',
                    message: `Groq AI usage is at ${usagePercent.toFixed(1)}%. Please upgrade soon to avoid service interruption.`,
                    urgency: 'critical',
                    color: 'error'
                });
                if (!pool.lastGroqAlert) pool.lastGroqAlert = {};
                pool.lastGroqAlert.groq95 = new Date();
            } else if (usagePercent >= 80 && (!pool.lastGroqAlert?.groq80 || (Date.now() - new Date(pool.lastGroqAlert.groq80).getTime() > 24 * 60 * 60 * 1000))) {
                pool.notifications.push({
                    type: 'alert',
                    title: 'Groq Usage Warning',
                    message: `Groq AI usage has reached ${usagePercent.toFixed(1)}%.`,
                    urgency: 'medium',
                    color: 'warning'
                });
                if (!pool.lastGroqAlert) pool.lastGroqAlert = {};
                pool.lastGroqAlert.groq80 = new Date();
            }

            await pool.save();
        }
        // --- END USAGE TRACKING ---

        // Post-processing: Smart merging and intelligent heading detection
        if (jsonResponse.sections && Array.isArray(jsonResponse.sections)) {
            const processedSections = [];
            const titleMap = new Map();

            for (let i = 0; i < jsonResponse.sections.length; i++) {
                const section = jsonResponse.sections[i];

                // Ensure subtitle field exists
                if (!section.hasOwnProperty('subtitle')) section.subtitle = "";

                // ============================================
                // INTELLIGENT HEADING DETECTION LOGIC
                // ============================================

                // Check if current section is 'plain' and could be a heading
                if (section.type === 'plain') {
                    const isShortTitle = section.title && section.title.length < 100;
                    const hasMinimalContent = !section.content || section.content.trim().length < 50;
                    const hasFollowingSections = i < jsonResponse.sections.length - 1;

                    if (isShortTitle && hasMinimalContent && hasFollowingSections) {
                        // Count how many sections follow with different titles
                        let followingSectionsCount = 0;
                        for (let j = i + 1; j < jsonResponse.sections.length; j++) {
                            const nextSection = jsonResponse.sections[j];
                            if (nextSection.title && nextSection.title.trim().toLowerCase() !== section.title.trim().toLowerCase()) {
                                followingSectionsCount++;
                            }
                            // Stop counting if we hit another potential heading
                            if (nextSection.type === 'heading') break;
                        }

                        // Convert to heading if it precedes multiple sections
                        if (followingSectionsCount >= 2) {
                            section.type = 'heading';
                            section.content = ""; // Headings should have empty content
                        }
                    }
                }

                // Smart heading validation: heading should only exist if followed by multiple sections
                if (section.type === 'heading') {
                    const nextSectionsCount = jsonResponse.sections.slice(i + 1).filter(s => s.type !== 'heading').length;
                    if (nextSectionsCount < 2) {
                        // Convert to title type if not followed by multiple sections
                        section.type = 'title';
                    }
                }

                const titleKey = section.title?.trim().toLowerCase() || '';

                if (titleKey && titleMap.has(titleKey)) {
                    // Merge with existing section
                    const existingSection = titleMap.get(titleKey);

                    // Don't merge headings
                    if (section.type === 'heading' || existingSection.type === 'heading') {
                        processedSections.push(section);
                        continue;
                    }

                    // Combine content
                    if (section.content) {
                        existingSection.content = existingSection.content
                            ? `${existingSection.content}\n${section.content}`
                            : section.content;
                    }

                    // Keep subtitle if new section has one
                    if (section.subtitle && !existingSection.subtitle) {
                        existingSection.subtitle = section.subtitle;
                    }
                } else {
                    // New section
                    titleMap.set(titleKey, section);
                    processedSections.push(section);
                }
            }

            jsonResponse.sections = processedSections;
        }

        res.json(jsonResponse);

    } catch (error) {
        console.error("AI Formatting Error:", error);
        res.status(500).json({
            error: "Failed to format content with AI",
            details: error.message
        });
    }
};