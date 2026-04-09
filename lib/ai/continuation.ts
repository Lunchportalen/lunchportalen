import "server-only";

export type ContinuationContext = {
  pageTitle?: string;
  heading?: string;
  blockId?: string;
};

const MAX_CHARS = 900;

function clampSentences(s: string, maxSentences: number): string {
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= maxSentences) return s.trim();
  return parts.slice(0, maxSentences).join(" ").trim();
}

/**
 * Deterministic multi-line continuation (no network). Replace with model-backed logic when wired.
 * Returns 2–4 short sentences; may include paragraph breaks.
 */
export function generateContinuation(text: string, context: ContinuationContext): { continuation: string } {
  const t = text.trimEnd();
  if (t.length === 0) {
    return { continuation: "" };
  }

  const lower = t.toLowerCase();
  const hint = (context.heading || context.pageTitle || "").trim();

  if (/kontakt/.test(lower.slice(-40))) {
    const c =
      " Ta gjerne kontakt dersom dere vil vite mer om oppstart og praktiske detaljer.\n\nVi svarer raskt og kan tilpasse opplegget til deres hverdag.";
    return { continuation: clampSentences(c, 4).slice(0, MAX_CHARS) };
  }

  if (/\blunsj\b/.test(lower) && /(for|til)\s*$/i.test(t)) {
    const c =
      " Målet er forutsigbar drift og mindre friksjon for både ansatte og admin.\n\nAlt kan styres samlet – uten unødvendig manuelt arbeid.";
    return { continuation: clampSentences(c, 4).slice(0, MAX_CHARS) };
  }

  if (/velkommen/.test(lower)) {
    const c =
      " Her får dere oversikt over det viktigste, steg for steg.\n\nSi fra hvis dere vil ha en gjennomgang – vi hjelper dere i gang.";
    return { continuation: clampSentences(c, 4).slice(0, MAX_CHARS) };
  }

  if (hint.length > 4 && t.length < 200) {
    const short = hint.length > 48 ? `${hint.slice(0, 48)}…` : hint;
    const c = ` Under «${short}» kan dere utdype med konkrete eksempler og tydelige neste steg.\n\nHold språket enkelt og konkret – det øker både forståelse og tillit.`;
    return { continuation: clampSentences(c, 4).slice(0, MAX_CHARS) };
  }

  const fallbacks = [
    " Dette gir bedre oversikt og mindre manuelt arbeid i hverdagen.\n\nNår dere er klare, kan neste steg være å konkretisere ansvar og rutiner.",
    " Kort oppsummert: dere får mer kontroll med samme innsats.\n\nTa kontakt hvis dere vil se hvordan dette ser ut for deres organisasjon.",
    " Løsningen er bygget for trygg drift – uten unødvendig kompleksitet.\n\nVi anbefaler å beskrive neste steg tydelig for leseren her.",
  ];
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    h = (h + t.charCodeAt(i)) % 1009;
  }
  const c = fallbacks[h % fallbacks.length]!;
  return { continuation: clampSentences(c, 4).slice(0, MAX_CHARS) };
}
