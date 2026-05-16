import OpenAI from 'openai';

// Ensure you have OPENAI_API_KEY in your .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const generateProposalContent = async (req, res) => {
    try {
        const { projectBrief, companyName = "Humantek" } = req.body;

        if (!projectBrief) {
            return res.status(400).json({ error: "Project brief is required" });
        }

const systemPrompt = `You are an expert business proposal writer for a digital agency named ${companyName}.
Your task is to take a raw "Project Brief" from the user and generate a highly professional, comprehensive, and structured proposal.

You must return EXACTLY a JSON object with two top-level keys: "sections" and "tables".
Do NOT return Markdown. Do NOT return anything other than the JSON object.

The output JSON must strictly follow this structure:
{
  "sections": [
    {
      "type": "heading" | "title" | "plain",
      "title": "Section Title",
      "content": "Section text. MUST be formatted in basic HTML (e.g., <p>, <ul>, <ol>, <li>, <strong>). Use <ul> and <li> for any bulleted lists."
    }
  ],
  "tables": []
}

### Guidelines for "sections" array:
- Create sections EXACTLY matching the Template structure provided below.
- "type": 
  - "heading": For major document dividers (e.g. Scope of Work, Deliverables, Timeline, Pricing). Leave "content" empty.
  - "title": For a regular section with a title and paragraph/list content.
  - "plain": For plain text without a title.
- CRITICAL: "content" must ALWAYS use HTML tags. If there is a list, you MUST use <ul><li>...</li></ul> or <ol><li>...</li></ol>.

### TEMPLATE TO STRICTLY FOLLOW (Map the brief into this exact flow):

1. Company Introduction
   - About ${companyName} (Highlight expertise in digital solutions, branding, social media, performance marketing)
2. Proposal Overview
   - Provide a targeted overview of what this proposal achieves for the client's specific industry.
3. Objectives
   - Bulleted list of key objectives.
4. Scope of Work (Use "type": "heading" for the main title)
   - 1. Social Media Management (Title) + Content
   - 2. Branding Optimization (Title) + Content
   - 3. Performance Marketing (Title) + Content (Include Target Audience and Target Locations)
5. Deliverables (Use "type": "heading" for the main title)
   - Monthly Deliverables (Title) + Content (Breakdown by Social Media, Performance Marketing, Branding)
6. Timeline (Use "type": "heading" for the main title)
   - Initial Setup Phase (Title) + Content
   - Monthly Execution Cycle (Title) + Content
7. Pricing (Use "type": "heading" for the main title)
   - [Service Name 1] Package (Title) + Price & Includes
   - [Service Name 2] Package (Title) + Price & Includes
   - Total Monthly Fee (Title) + Price & Note
8. Why ${companyName}?
   - Bulleted list of agency strengths.
9. Expected Outcomes
   - Bulleted list of outcomes.
10. Closing Statement
    - Professional closing remarks.
11. Contact Information
    - Digital Solutions & Marketing Agency, Email, Phone, Website.

### Guidelines for "tables" array:
- ALWAYS return an empty array \`[]\` for "tables".

Make the proposal content highly detailed, persuasive, and exactly matching the context provided in the brief while STRICTLY conforming to the Template above. Write in a corporate, professional tone.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // or gpt-4o for better quality
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Project Brief:\n${projectBrief}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const jsonResponse = JSON.parse(completion.choices[0].message.content);

        // POST-PROCESS AI OUTPUT TO GUARANTEE PERFECT HTML LISTS
        if (jsonResponse.sections && Array.isArray(jsonResponse.sections)) {
            jsonResponse.sections = jsonResponse.sections.map(sec => {
                if (sec.content && sec.content.includes("•")) {
                    // Strip weak formatting to avoid double tags
                    let plainText = sec.content.replace(/<[^>]+>/g, "");
                    const parts = plainText.split("•");
                    
                    let intro = parts[0].trim();
                    let items = parts.slice(1).map(s => s.trim()).filter(Boolean);
                    
                    let htmlContent = "";
                    if (intro) {
                        htmlContent += `<p>${intro}</p>`;
                    }
                    if (items.length > 0) {
                        htmlContent += "<ul>";
                        items.forEach(item => {
                            htmlContent += `<li>${item}</li>`;
                        });
                        htmlContent += "</ul>";
                    }
                    sec.content = htmlContent;
                } else if (sec.content && !sec.content.includes("<p>")) {
                    // Wrap standard text in paragraph
                    sec.content = `<p>${sec.content}</p>`;
                }
                return sec;
            });
        }

        return res.status(200).json(jsonResponse);
    } catch (error) {
        console.error("OpenAI Proposal Generation Error:", error);
        return res.status(500).json({ error: "Failed to generate proposal with AI", details: error.message });
    }
};
