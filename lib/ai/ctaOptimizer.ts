/**
 * Enkel, deterministisk CTA-forsterker (ingen LLM).
 */
export function optimizeCTA(text: string): string {
  const t = typeof text === "string" ? text : "";
  if (!t.toLowerCase().includes("kontakt")) {
    return `${t}\n\n👉 Ta kontakt for en uforpliktende prat`.trim();
  }
  return t;
}
