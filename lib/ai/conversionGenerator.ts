import "server-only";

import { runOpenAiConversionChat } from "@/lib/ai/runner";

const FALLBACK_TEXT =
  "Hook: Mindre administrasjon rundt bedriftens lunsj.\n\n" +
  "Problem: Uforutsigbar bestilling og tidstyver i hverdagen.\n\n" +
  "Løsning: Lunchportalen samler kommunikasjon, lokalt kjøkken og forutsigbare leveranser.\n\n" +
  "CTA: Ta kontakt for en uforpliktende prat.";

export async function generateConversionPost(input: {
  product: string;
  audience: string;
  goal: string;
  /** Valgfri: observerte høyytelses-hook fra vekstmotor (deterministisk tekst). */
  growthHints?: string;
  /** Valgfri: ordre-attribuerte topp-poster (deterministisk — ikke overstyr menneskelig redigert innhold). */
  revenueHints?: string;
}): Promise<{ ok: true; text: string } | { ok: false; text: string }> {
  const hints =
    typeof input.growthHints === "string" && input.growthHints.trim()
      ? `\n\nObservasjoner fra faktisk ytelse (bruk som inspirasjon, ikke kopier ordrett):\n${input.growthHints.trim()}\n`
      : "";
  const rev =
    typeof input.revenueHints === "string" && input.revenueHints.trim()
      ? `\n\nOrdre-basert læring (faktiske tall — inspirasjon, ikke kopier ordrett):\n${input.revenueHints.trim()}\n`
      : "";
  const prompt =
    `Du er en ekspert på B2B salg.\n\n` +
    `Skriv et kort innlegg som:\n\n` +
    `- Fanger oppmerksomhet på 2 sek\n` +
    `- Trigger et problem\n` +
    `- Gir en konkret løsning\n` +
    `- Har tydelig CTA\n\n` +
    `Produkt: ${input.product}\n` +
    `Målgruppe: ${input.audience}\n` +
    `Mål: ${input.goal}\n` +
    hints +
    rev +
    `\n` +
    `Format:\n` +
    `Hook\n` +
    `Problem\n` +
    `Løsning\n` +
    `CTA\n`;

  try {
    const res = await runOpenAiConversionChat({ userPrompt: prompt, temperature: 0.7 });
    if (!res.ok || !res.text.trim()) {
      return { ok: false, text: FALLBACK_TEXT };
    }
    return { ok: true, text: res.text.trim() };
  } catch {
    return { ok: false, text: FALLBACK_TEXT };
  }
}
