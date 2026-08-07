/**
 * Heuristic: treat postings as software/tech roles if title or description
 * matches common engineering / development patterns. When in doubt, returns true
 * so applications are not wrongly excluded from counts.
 */
const SOFTWARE_REGEXES: RegExp[] = [
  /\bsoftware\b/i,
  /\bdeveloper\b/i,
  /\bprogramm(er|ing)\b/i,
  /\bdevops\b/i,
  /\bfull[\s-]?stack\b/i,
  /\bback[\s-]?end\b/i,
  /\bbackend\b/i,
  /\bfront[\s-]?end\b/i,
  /\bfrontend\b/i,
  /\b(swe|sde|sdet)\b/i,
  /\bweb\s+(developer|engineer)\b/i,
  /\bmobile\s+(developer|engineer)\b/i,
  /\bios\b.*\b(engineer|developer)\b/i,
  /\bandroid\b.*\b(engineer|developer)\b/i,
  /\bdata\s+(engineer|scientist)\b/i,
  /\bmachine\s+learning\b/i,
  /\bml\s+engineer\b/i,
  /\b(site\s+reliability|platform)\s+engineer\b/i,
  /\bsre\b/i,
  /\bcloud\s+(engineer|architect|developer)\b/i,
  /\b(?:qa|quality)\s+engineer\b/i,
  /\bautomation\s+engineer\b/i,
  /\bembedded\b/i,
  /\bfirmware\b/i,
  /\btypescript\b/i,
  /\bjavascript\b/i,
  /\breact\b/i,
  /\bangular\b/i,
  /\bvue\.?js\b/i,
  /\bnode\.?js\b/i,
  /\b\.net\b/i,
  /\bgolang\b|\bgo\s+engineer\b/i,
  /\brust\b.*\b(engineer|developer)\b/i,
  /\bjava\b.*\b(developer|engineer|backend)\b/i,
  /\bpython\b.*\b(developer|engineer)\b/i,
  /\bkubernetes\b/i,
  /\bdocker\b/i,
  /\baws\b/i,
  /\bazure\b/i,
  /\bgcp\b/i,
  /\b(?:software|systems?|application)\s+engineer\b/i,
  /\bengineering\s+manager\b.*\b(tech|software|engineering)\b/i,
  /\btech\s+lead\b/i,
];

export function isSoftwareJob(title: string, jobDescription: string): boolean {
  const text = `${title || ""}\n${jobDescription || ""}`;
  return SOFTWARE_REGEXES.some((re) => re.test(text));
}
