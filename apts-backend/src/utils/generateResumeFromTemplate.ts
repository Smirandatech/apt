import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import axios from "axios";
import { z } from "zod";
import { ResumeSchema } from "../routes/resume";
import { ordinal } from "./ordinal";

type ResumeData = z.infer<typeof ResumeSchema>;
type TextRun = { text: string; bold?: boolean };

/** Normalize Unicode asterisk variants to ASCII * so bold markdown parses correctly */
function normalizeAsterisks(s: string): string {
  return s
    .replace(/\uFF0A/g, "*")   // full-width asterisk ＊
    .replace(/\u2217/g, "*");  // asterisk operator ∗
}

function parseBoldRunsFromLine(line: string): TextRun[] {
  const content = normalizeAsterisks(line.replace(/^•\s*/, "").trim()); // remove bullet, normalize asterisks
  // Use [\s\S] instead of . to match newlines; +? for non-greedy match
  const boldPattern = /\*\*([\s\S]+?)\*\*/g;
  const runs: TextRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(content)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plain = content.slice(lastIndex, match.index);
      if (plain) runs.push({ text: plain });
    }
    runs.push({ text: match[1].trim(), bold: true });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < content.length) {
    const plain = content.slice(lastIndex);
    if (plain) runs.push({ text: plain });
  }

  return runs.filter((r) => r.text !== undefined && r.text !== "");
}

/**
 * Remove markdown-style **bold** markers from plain text placeholders (e.g. summary).
 * Word templates using {{summary}} cannot apply bold from JSON without a runs loop or extra modules.
 */
function stripInlineMarkdownBold(input: string): string {
  let s = normalizeAsterisks(input);
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, (_, inner: string) => inner.trim());
  }
  return s.replace(/\*\*/g, "");
}

export async function generateResumeFromTemplate(
  data: ResumeData,
  companyCount: number,
  templatePath: string
): Promise<Buffer> {
  const response = await axios.get(templatePath, {
    responseType: "arraybuffer",
  });
  const content = response.data;
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  const dataToInject: Record<string, any> = {
    summary: stripInlineMarkdownBold(data.summary),
    technical_skills: data.technical_skills,
  };

  const experienceKeys = [
    "experience_first",
    "experience_second",
    "experience_third",
    "experience_fourth",
  ];

  for (let i = 0; i < companyCount && i < experienceKeys.length; i++) {
    const tag = ordinal(i + 1); // "First", "Second", etc.
    const lines = data[experienceKeys[i] as keyof typeof data] || [];
    dataToInject[tag] = (lines as Array<string>).map((line: string): { runs: TextRun[] } => ({
      runs: parseBoldRunsFromLine(line),
    }));
  }

  try {
    doc.render(dataToInject);
  } catch (error) {
    console.error("Template render error:", error);
    throw error;
  }

  return doc.getZip().generate({ type: "nodebuffer" });
}
