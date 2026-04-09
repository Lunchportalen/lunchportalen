/**
 * AI brukes kun til tekst — strategi og klassifisering er deterministiske.
 */
import "server-only";

import { getAIClient } from "@/lib/ai/getClient";
import type { ObjectionType } from "@/lib/sales/objections";
import type { SalesReplyContext } from "@/lib/sales/context";

const FALLBACK_REPLY =
  "Skjønner. Kanskje vi kan ta en kort prat og se om det gir verdi?";

function limitLines(text: string, maxLines: number): string {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.slice(0, maxLines).join("\n");
}

function resolveModel(): string {
  const m = process.env.OPENAI_DEFAULT_MODEL?.trim() || process.env.AI_MODEL?.trim();
  return m || "gpt-4o-mini";
}

export type AdaptiveReplyInput = {
  objection: ObjectionType;
  strategy: string;
  context: SalesReplyContext;
  message: string;
};

export type AdaptiveReplyResult = {
  text: string;
  fallbackUsed: boolean;
};

/**
 * Genererer kort, profesjonelt norsk svar — feiler trygt med fast fallback.
 */
export async function generateAdaptiveReply(input: AdaptiveReplyInput): Promise<AdaptiveReplyResult> {
  const system = `Du er en erfaren B2B-rådgiver for bedriftslunsj og kantineoppdrag i Norge.
Du skriver KUN selgerens neste melding til kunden.
Regler:
- Maks 4 korte linjer (én setning per linje er OK).
- Profesjonell, varm tone — ikke pushy.
- Konkret verdi; ingen tom lovprisning.
- Norsk bokmål.
- Ingen emojis. Ingen prisløfter du ikke kan holde.
- Ikke oppfinn tall eller avtaler som ikke er i konteksten.`;

  const user = `Kontekst:
- Firma: ${input.context.company ?? "ukjent"}
- Stage: ${input.context.stage ?? "ukjent"}
- Prognosesannsynlighet (0–100): ${input.context.probability != null ? String(Math.round(input.context.probability)) : "ukjent"}
- Siste registrerte handling: ${input.context.lastAction ?? "ingen"}
${input.context.notesSnippet ? `- Notat/historikk (utdrag): ${input.context.notesSnippet}` : ""}

Klassifisert innvending (maskin): ${input.objection}
Valgt strategi (maskin): ${input.strategy}

Kundens melding:
${input.message}

Skriv selgerens svar som ren tekst (ingen overskrifter).`;

  try {
    const client = getAIClient();
    const res = await client.chat.completions.create({
      model: resolveModel(),
      temperature: 0.35,
      max_tokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) {
      return { text: FALLBACK_REPLY, fallbackUsed: true };
    }
    const trimmed = limitLines(raw, 4);
    if (!trimmed) {
      return { text: FALLBACK_REPLY, fallbackUsed: true };
    }
    return { text: trimmed, fallbackUsed: false };
  } catch (e) {
    console.error("[generateAdaptiveReply]", e instanceof Error ? e.message : String(e));
    return { text: FALLBACK_REPLY, fallbackUsed: true };
  }
}

export const OBJECTION_FALLBACK_REPLY = FALLBACK_REPLY;
