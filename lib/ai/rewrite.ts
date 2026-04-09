import "server-only";

const MAX_CHARS = 4000;

function normalizeIntent(raw: string): "shorter" | "clearer" | "more persuasive" | "neutral" {
  const i = raw.trim().toLowerCase();
  if (/kort|kortere|shorter|brief|tighter/.test(i)) return "shorter";
  if (/klar|tydelig|clearer|enkelt|simple|plain/.test(i)) return "clearer";
  if (/overbevis|salgs|persuasive|sterk|punch|slag|skarp/.test(i)) return "more persuasive";
  return "neutral";
}

/**
 * Deterministic inline rewrite (no network). Replace with model-backed logic when wired.
 */
export function rewriteText(text: string, intent: string): { rewritten: string } {
  const t = text.replace(/\r\n/g, "\n");
  if (!t.trim()) {
    return { rewritten: "" };
  }

  const mode = normalizeIntent(intent);

  if (mode === "shorter") {
    const sentences = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const keep = sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2)));
    let out = keep.join(" ");
    if (out.length > t.length * 0.85) {
      out = t.replace(/\s+/g, " ").trim();
      const cut = out.slice(0, Math.floor(out.length * 0.65)).replace(/\s+\S*$/, "");
      out = cut.length > 12 ? `${cut}…` : out;
    }
    return { rewritten: out.slice(0, MAX_CHARS) };
  }

  if (mode === "clearer") {
    let out = t
      .replace(/\b(i forhold til)\b/gi, "for")
      .replace(/\b(av den grunn)\b/gi, "derfor")
      .replace(/\s+/g, " ")
      .trim();
    if (out === t) {
      out = t.replace(/\n{3,}/g, "\n\n").trim();
    }
    if (!/[.!?]$/.test(out)) {
      out = `${out}.`;
    }
    return { rewritten: out.slice(0, MAX_CHARS) };
  }

  if (mode === "more persuasive") {
    const lead = t.trim();
    const out = lead.match(/^(vi|dere|lunsjportalen)/i)
      ? `${lead}\n\nDette gir mer kontroll, lavere friksjon og tryggere drift i hverdagen.`
      : `Med dette får dere en tydelig gevinst: ${lead.charAt(0).toLowerCase()}${lead.slice(1)}`;
    return { rewritten: out.trim().slice(0, MAX_CHARS) };
  }

  return { rewritten: t.trim().slice(0, MAX_CHARS) };
}
