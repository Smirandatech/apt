import express from "express";
import { OpenAI } from "openai";
import axios from "axios";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { generateResumeFromTemplate } from "../utils/generateResumeFromTemplate";
import { uploadToDrive } from "../utils/uploadToDrive";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import pool from "../db/pool";

const router = express.Router();

// Define expected GPT structured response schema
export const ResumeSchema = z.object({
  companyName: z.string(),
  roleTitle: z.string(),
  isSecurityClearanceRequired: z.boolean(),
  summary: z.string(),
  technical_skills: z.array(
    z.object({
      category: z.string(),
      items: z.array(z.string()),
    })
  ),
  experience_first: z.array(z.string()),
  experience_second: z.array(z.string()),
  experience_third: z.array(z.string()),
  experience_fourth: z.array(z.string()),
  experience_fifth: z.array(z.string()),
  experience_sixth: z.array(z.string()),
});

const ExperienceFieldOrder = [
  "experience_first",
  "experience_second",
  "experience_third",
  "experience_fourth",
  "experience_fifth",
  "experience_sixth",
] as const;

const DeepseekResumeSchema = z.object({
  companyName: z.string(),
  roleTitle: z.string(),
  isSecurityClearanceRequired: z.boolean(),
  summary: z.string(),
  technical_skills: z.array(
    z.object({
      category: z.string(),
      items: z.array(z.string()),
    })
  ),
  company_order: z.array(z.string()),
  experiences_by_company: z.array(
    z.object({
      company: z.string(),
      bullets: z.array(z.string()),
    })
  ),
});

function normalizeCompanyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapDeepseekToResumeSchema(data: z.infer<typeof DeepseekResumeSchema>): z.infer<typeof ResumeSchema> {
  const mappedExperience: Record<(typeof ExperienceFieldOrder)[number], string[]> = {
    experience_first: [],
    experience_second: [],
    experience_third: [],
    experience_fourth: [],
    experience_fifth: [],
    experience_sixth: [],
  };

  const normalizedExperienceMap = new Map<string, string[]>();
  for (const item of data.experiences_by_company) {
    const normalized = normalizeCompanyKey(item.company);
    if (!normalized) continue;
    if (!normalizedExperienceMap.has(normalized)) {
      normalizedExperienceMap.set(normalized, item.bullets);
    }
  }

  for (let i = 0; i < ExperienceFieldOrder.length; i++) {
    const field = ExperienceFieldOrder[i];
    const companyFromOrder = data.company_order[i];
    if (!companyFromOrder) continue;
    const bullets = normalizedExperienceMap.get(normalizeCompanyKey(companyFromOrder));
    mappedExperience[field] = bullets ?? [];
  }

  return {
    companyName: data.companyName,
    roleTitle: data.roleTitle,
    isSecurityClearanceRequired: data.isSecurityClearanceRequired,
    summary: data.summary,
    technical_skills: data.technical_skills,
    ...mappedExperience,
  };
}

// ---------- helpers for DeepSeek JSON handling ----------

/**
 * Strong JSON-only instructions for DeepSeek.
 * We explicitly describe the expected shape and forbid prose.
 */
function buildDeepseekMessages(prompt: string, jobDescription: string) {
  const schemaDescription = `
Return ONLY a JSON object with this exact shape (no backticks, no prose):
{
  "companyName": string,
  "roleTitle": string,
  "isSecurityClearanceRequired": boolean,
  "summary": string,
  "technical_skills": [
    { "category": string, "items": string[] }
  ],
  "company_order": string[],
  "experiences_by_company": [
    { "company": string, "bullets": string[] }
  ]
}
Rules:
- Do not include any keys not listed above.
- Use valid UTF-8 JSON.
- Do not wrap in markdown fences.
- Keep booleans strictly true/false.
- company_order must list companies exactly in the order they appear in the profile/template prompt.
- experiences_by_company may be in any order, but each company value must exactly match one entry in company_order.
- If a company has no relevant bullet, include that company with an empty bullets array.
- For each bullet in experiences_by_company.bullets: bold relevant skills by wrapping them in double asterisks, e.g. "Built **Python** scripts" or "Used **React** and **Node.js**". Use plain ASCII asterisk (*) characters only.
`;

  return [
    { role: "system", content: `${prompt}\n\n${schemaDescription}` },
    { role: "user", content: jobDescription },
  ] as const;
}

/**
 * Extracts the first valid JSON object from a string.
 * Handles common cases: code fences, stray text before/after, and whitespace.
 */
function extractJsonObject(raw: string): any {
  // 1) Quick path: direct JSON
  try {
    return JSON.parse(raw);
  } catch {}

  // 2) Code fence: ```json ... ``` or ``` ... ```
  const fenceMatch =
    raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    const inner = fenceMatch[1].trim();
    try {
      return JSON.parse(inner);
    } catch {}
  }

  // 3) Find first balanced { ... } block (basic scanner)
  const start = raw.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = raw.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {}
        }
      }
    }
  }

  throw new Error("No valid JSON object found in model response");
}

router.post(
  "/generate",
  authenticateToken,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { jobDescription, companyName } = req.body;

    if (!jobDescription) {
      res.status(400).json({ error: "Missing job description" });
      return;
    }

    try {
      let templatePath: string;
      let companyCount = 0;
      // let folderId: string;
      let prompt: string;
      let apiKey: string;
      let deepseekKey: string;
      let model: string;

      // Get template info for bidder
      if (req.user?.role === "bidder") {
        const result = await pool.query(
          `SELECT 
              rt.prompt, 
              rt.file_url, 
              rt.company_count, 
              bc.drive_folder_id,
              u.openai_api_key, 
              u.deepseek_api_key,
              u.preferred_ai_model
           FROM bidder_configs bc
           JOIN resume_templates rt ON bc.template_id = rt.id
           JOIN users u ON bc.developer_id = u.id
           WHERE bc.bidder_id = $1`,
          [req.user.id]
        );

        const row = result.rows[0];
        if (!row) {
          res.status(400).json({ error: "No resume configuration found" });
          return;
        }

        // Validation checks
        if (!row.file_url) {
          res.status(400).json({ error: "No resume template assigned to bidder" });
          return;
        }
        if (!row.company_count) {
          res.status(400).json({ error: "Invalid company count" });
          return;
        }
        // if (!row.drive_folder_id) {
        //   res.status(400).json({ error: "No Google Drive folder ID" });
        //   return;
        // }
        if (!row.prompt) {
          res.status(400).json({ error: "No Prompt for Resume Template" });
          return;
        }

        // Extract info
        templatePath = row.file_url;
        companyCount = row.company_count;
        // folderId = row.drive_folder_id;
        prompt = row.prompt;
        apiKey = row.openai_api_key;
        deepseekKey = row.deepseek_api_key;
        model = row.preferred_ai_model || "gpt-4o";
      } else {
        res.status(403).json({ error: "Only bidders can generate resumes." });
        return;
      }

      // -------------------------------
      // 🧠  MODEL LOGIC SWITCH
      // -------------------------------
      let parsed: unknown;

      if (model.startsWith("gpt-4")) {
        if (!apiKey) {
          res.status(400).json({
            error: "Developer has no OpenAI API key configured",
          });
          return;
        }

        const openai = new OpenAI({ apiKey });

        const chat = await openai.beta.chat.completions.parse({
          model,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: jobDescription },
          ],
          response_format: zodResponseFormat(ResumeSchema, "resume_extraction"),
          temperature: 0,
        });

        if (!chat.choices[0].message.content) {
          throw new Error("Chat response content is null or undefined");
        }

        parsed = JSON.parse(chat.choices[0].message.content);
      } else if (model === "deepseek") {
        if (!deepseekKey) {
          res.status(400).json({
            error: "Developer has no DeepSeek API key configured",
          });
          return;
        }

        // Build strong JSON-only messages
        const messages = buildDeepseekMessages(prompt, jobDescription);

        const response = await axios.post(
          "https://api.deepseek.com/v1/chat/completions",
          {
            model: "deepseek-v4-flash",
            messages,
            temperature: 0,
            // If DeepSeek supports JSON mode, this helps. If not, it is ignored.
            response_format: { type: "json_object" },
          },
          {
            headers: {
              Authorization: `Bearer ${deepseekKey}`,
              "Content-Type": "application/json",
            },
            timeout: 60_000,
          }
        );

        const content = response.data?.choices?.[0]?.message?.content;

        if (!content || typeof content !== "string") {
          throw new Error("DeepSeek response is missing or invalid");
        }

        // Robust JSON extraction
        const obj = extractJsonObject(content);

        // Validate DeepSeek-specific shape, then map deterministically to resume fields.
        const validation = DeepseekResumeSchema.safeParse(obj);
        if (!validation.success) {
          res.status(400).json({
            error: "DeepSeek JSON did not match expected schema",
            details: validation.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
            rawContentPreview: content.slice(0, 800),
          });
          return;
        }

        parsed = mapDeepseekToResumeSchema(validation.data);
      } else {
        res.status(400).json({ error: `Unsupported model: ${model}` });
        return;
      }

      // -------------------------------
      // 🛑  Security clearance check
      // -------------------------------
      // at this point parsed should be typed; validate again for safety if it came from OpenAI
      const parsedValidation = ResumeSchema.safeParse(parsed);
      if (!parsedValidation.success) {
        res.status(400).json({
          error: "Model output did not match expected schema",
          details: parsedValidation.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
        return;
      }
      const data = parsedValidation.data;

      if (data.isSecurityClearanceRequired) {
        res.status(400).json({
          error: "Job requires security clearance. Resume generation denied.",
          clearance: true,
        });
        return;
      }

      // -------------------------------
      // 🧾  Generate DOCX Resume
      // -------------------------------
      const buffer = await generateResumeFromTemplate(
        data,
        companyCount,
        templatePath
      );

      const safeCompany = (companyName || data.companyName || "resume")
        .toString()
        .replace(/[\\/:*?"<>|]+/g, "_")
        .slice(0, 120);

      const filename = `${safeCompany}.docx`;
      // const driveUrl = await uploadToDrive(buffer, filename, folderId);
      const base64Data = buffer.toString("base64");

      res.json({
        file: base64Data,
        filename: filename,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // driveUrl,
        parsed: data,
      });
    } catch (err: any) {
      console.error("Resume generation failed:", err);
      res.status(500).json({
        error: "Resume generation failed",
        detail: err?.message ?? "Unknown error",
      });
    }
  }
);

// ---------- Cover Letter Generation ----------

/**
 * Build DeepSeek messages for cover letter generation.
 * Extracts profile information from the resume prompt and uses it with the job description.
 */
function buildCoverLetterMessages(profilePrompt: string, jobDescription: string, candidateName: string) {
  const systemPrompt = `You are an expert cover letter writer. You will be given:
1. A profile/resume prompt that contains the candidate's professional information, skills, and experience
2. A job description
3. The candidate's name

Your task is to write a professional, compelling cover letter that:
- Highlights relevant experience and skills from the profile that match the job requirements
- Is personalized to the specific company and role
- Maintains a professional yet engaging tone
- Is concise (around 300-400 words)
- Follows standard cover letter format with proper salutation and closing

CRITICAL: The candidate's name is "${candidateName}". You MUST use this exact name "${candidateName}" in the cover letter signature at the end. DO NOT use placeholders like "[Your Name]", "[Name]", "Your Name", or "Candidate". Always sign the letter with: "${candidateName}"

IMPORTANT: Return ONLY a JSON object with this exact shape (no backticks, no prose):
{
  "companyName": string,
  "roleTitle": string,
  "candidateName": string,
  "coverLetterContent": string
}

Rules:
- The coverLetterContent should be the full cover letter text with proper paragraphs (use \\n for line breaks)
- The cover letter signature at the end MUST be "${candidateName}" - this is required
- Extract companyName and roleTitle from the job description
- candidateName MUST be "${candidateName}"
- Do not include any keys not listed above
- Use valid UTF-8 JSON
- Do not wrap in markdown fences

Here is the profile/resume information to reference:
${profilePrompt}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Please write a cover letter for this job:\n\n${jobDescription}` },
  ] as const;
}

// Cover Letter response schema
const CoverLetterSchema = z.object({
  companyName: z.string(),
  roleTitle: z.string(),
  candidateName: z.string(),
  coverLetterContent: z.string(),
});

/**
 * Generate a DOCX document from cover letter content
 */
async function generateCoverLetterDoc(content: string): Promise<Buffer> {
  // Split content by newlines and create paragraphs
  const paragraphs = content.split(/\n\n|\n/).filter(p => p.trim());
  
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.map(
          (text) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: text.trim(),
                  size: 24, // 12pt font (size is in half-points)
                }),
              ],
              spacing: {
                after: 200, // Space after paragraph
              },
            })
        ),
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

router.post(
  "/generate-cover-letter",
  authenticateToken,
  async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    const { jobDescription, companyName } = req.body;

    if (!jobDescription) {
      res.status(400).json({ error: "Missing job description" });
      return;
    }

    try {
      let prompt: string;
      let deepseekKey: string;
      let candidateName: string;

      // Get profile info (prompt) and template name for bidder
      if (req.user?.role === "bidder") {
        const result = await pool.query(
          `SELECT 
              rt.prompt,
              rt.name as template_name,
              u.deepseek_api_key
           FROM bidder_configs bc
           JOIN resume_templates rt ON bc.template_id = rt.id
           JOIN users u ON bc.developer_id = u.id
           WHERE bc.bidder_id = $1`,
          [req.user.id]
        );

        const row = result.rows[0];
        if (!row) {
          res.status(400).json({ error: "No configuration found for bidder" });
          return;
        }

        if (!row.prompt) {
          res.status(400).json({ error: "No profile prompt found. Please configure resume template with prompt." });
          return;
        }

        if (!row.deepseek_api_key) {
          res.status(400).json({ error: "Developer has no DeepSeek API key configured" });
          return;
        }

        prompt = row.prompt;
        deepseekKey = row.deepseek_api_key;
        candidateName = row.template_name || "Candidate";
      } else {
        res.status(403).json({ error: "Only bidders can generate cover letters." });
        return;
      }

      // Build messages for DeepSeek
      const messages = buildCoverLetterMessages(prompt, jobDescription, candidateName);

      // Call DeepSeek API
      const response = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages,
          temperature: 0.7, // Slightly creative for cover letters
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${deepseekKey}`,
            "Content-Type": "application/json",
          },
          timeout: 60_000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;

      if (!content || typeof content !== "string") {
        throw new Error("DeepSeek response is missing or invalid");
      }

      // Extract and validate JSON
      const obj = extractJsonObject(content);
      const validation = CoverLetterSchema.safeParse(obj);

      if (!validation.success) {
        res.status(400).json({
          error: "DeepSeek JSON did not match expected schema",
          details: validation.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
          rawContentPreview: content.slice(0, 800),
        });
        return;
      }

      const data = validation.data;

      // Generate DOCX document
      const buffer = await generateCoverLetterDoc(data.coverLetterContent);

      // Create safe filename
      const safeCompany = (companyName || data.companyName || "company")
        .toString()
        .replace(/[\\/:*?"<>|]+/g, "_")
        .slice(0, 120);

      const filename = `${safeCompany}_cv.docx`;
      const base64Data = buffer.toString("base64");

      res.json({
        file: base64Data,
        filename: filename,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        parsed: {
          companyName: data.companyName,
          roleTitle: data.roleTitle,
          candidateName: data.candidateName,
        },
      });
    } catch (err: any) {
      console.error("Cover letter generation failed:", err);
      res.status(500).json({
        error: "Cover letter generation failed",
        detail: err?.message ?? "Unknown error",
      });
    }
  }
);

export default router;
