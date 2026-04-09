/**
 * AI brukes kun til tekst — steg og timing er deterministiske.
 */
import "server-only";

import { getAIClient } from "@/lib/ai/getClient";
import type { SequenceStepDef } from "@/lib/sales/sequence";

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

const FALLBACK_SEQUENCE = `Hei!

Kort oppfølging fra oss angående bedriftslunsj — gi gjerne beskjed om det er aktuelt å ta en prat.

Mvh`;

export type LeadForSequence = {
  id: string;
  company_name?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function generateSequenceMessage(lead: LeadForSequence, step: SequenceStepDef): Promise<{ text: string; fallbackUsed: boolean }> {
  const meta = lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta) ? lead.meta : {};
  const company =
    typeof lead.company_name === "string" && lead.company_name.trim()
      ? lead.company_name.trim()
      : typeof meta.company_name === "string" && meta.company_name.trim()
        ? meta.company_name.trim()
        : "deres bedrift";
  const stage = typeof meta.pipeline_stage === "string" ? meta.pipeline_stage : "ukjent";
  const prev = typeof meta.sequence_draft_message === "string" ? meta.sequence_draft_message.slice(0, 400) : "";

  const system = `Du er en erfaren B2B-rådgiver for bedriftslunsj og kantine i Norge.
Skriv KUN én kort melding (uten emnefelt) som selgerens neste utkast.
Regler:
- Maks 4 korte linjer.
- Profesjonell, rolig tone — ikke pushy, ikke spam.
- Norsk bokmål.
- Ingen emojis. Ingen prisløfter.
- Variér i ordlyd fra eventuelt tidligere utkast (sammendrag gitt under).`;

  const user = `Firma: ${company}
Pipeline-trinn: ${stage}
Sekvenssteg: ${step.step} (${step.type}) — ${step.description}

Tidligere utkast (sammendrag, ikke kopier ordrett):
${prev || "(ingen)"}

Lag en ny kort melding som passer steget.`;

  try {
    const client = getAIClient();
    const res = await client.chat.completions.create({
      model: resolveModel(),
      temperature: 0.45,
      max_tokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) {
      return { text: FALLBACK_SEQUENCE, fallbackUsed: true };
    }
    const trimmed = limitLines(raw, 4);
    return trimmed ? { text: trimmed, fallbackUsed: false } : { text: FALLBACK_SEQUENCE, fallbackUsed: true };
  } catch (e) {
    console.error("[generateSequenceMessage]", e instanceof Error ? e.message : String(e));
    return { text: FALLBACK_SEQUENCE, fallbackUsed: true };
  }
}

export const SEQUENCE_MESSAGE_FALLBACK = FALLBACK_SEQUENCE;
