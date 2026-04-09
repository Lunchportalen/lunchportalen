/**
 * Deterministiske tekstvarianter for enkelt A/B (ingen LLM).
 */
export function generateVariants(baseText: string): string[] {
  const base = typeof baseText === "string" ? baseText : "";
  return [
    base,
    base.replace("Visste du", "De fleste bedrifter vet ikke"),
    base + "\n\n👉 Book en demo i dag",
  ];
}
