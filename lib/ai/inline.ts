import "server-only";

export type InlineContext = {
  pageTitle?: string;
  heading?: string;
  blockId?: string;
};

/**
 * Short, deterministic continuation (no network). Replace with model-backed logic later if needed.
 */
export function generateInlineCompletion(text: string, context: InlineContext): { completion: string } {
  const t = text.trimEnd();
  if (t.length < 10) return { completion: "" };

  const lower = t.toLowerCase();

  if (/kontakt/.test(lower.slice(-28))) {
    return { completion: " oss for en uforpliktende prat om behov og oppstart." };
  }

  if (/lunsj/.test(lower) && /\btil\s*$/i.test(t)) {
    return { completion: " bedrifter som vil ha en enkel og forutsigbar hverdag." };
  }

  if (/vi\s+leverer\b/i.test(t) && !/[\.\!\?]\s*$/.test(t)) {
    return { completion: " med fokus på kvalitet, punktlighet og ryddige rammer." };
  }

  if (/velkommen/.test(lower) && !/[\.\!\?]\s*$/.test(t)) {
    return { completion: " Vi gleder oss til å hjelpe dere i gang." };
  }

  const hint = (context.heading || context.pageTitle || "").trim();
  if (hint.length > 3 && t.length < 120 && !t.includes(hint.slice(0, 12))) {
    return { completion: ` Temaet «${hint.slice(0, 40)}${hint.length > 40 ? "…" : ""}» kan utdypes med konkrete eksempler her.` };
  }

  const fallbacks = [
    " Dette gir mindre administrasjon og bedre oversikt i hverdagen.",
    " Les mer om hvordan det fungerer, eller ta kontakt for demo.",
    " Alt skjer digitalt – enkelt for både ansatte og admin.",
  ];
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    h = (h + t.charCodeAt(i)) % 1009;
  }
  return { completion: fallbacks[h % fallbacks.length]! };
}
