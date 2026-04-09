/**
 * Kontekst til AI-tekstgenerering (beslutninger skjer utenfor LLM).
 */
export type LeadContextInput = {
  id: string;
  company_name?: string | null;
  meta?: Record<string, unknown> | null;
  /** Kanonisk pipeline-trinn (valgfritt hvis meta.pipeline_stage finnes). */
  stage?: string | null;
};

export type SalesReplyContext = {
  company: string | null;
  stage: string | null;
  probability: number | null;
  lastAction: string | null;
  /** Kort utdrag av notat/historikk fra meta (best-effort). */
  notesSnippet: string | null;
};

export function buildContext(lead: LeadContextInput): SalesReplyContext {
  const meta =
    lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta)
      ? (lead.meta as Record<string, unknown>)
      : {};

  let company: string | null = null;
  if (typeof lead.company_name === "string" && lead.company_name.trim()) {
    company = lead.company_name.trim();
  } else if (typeof meta.company_name === "string" && meta.company_name.trim()) {
    company = meta.company_name.trim();
  }

  const rawStage = meta.pipeline_stage;
  const stageFromMeta = typeof rawStage === "string" && rawStage.trim() ? rawStage.trim() : null;
  const stage = typeof lead.stage === "string" && lead.stage.trim() ? lead.stage.trim() : stageFromMeta;

  const prob = meta.predicted_probability;
  const probability =
    typeof prob === "number" && Number.isFinite(prob) ? prob : typeof prob === "string" && prob.trim() ? Number(prob) : null;

  const la = meta.last_action;
  const lastAction = typeof la === "string" && la.trim() ? la.trim().slice(0, 200) : null;

  const noteCandidates = [meta.notes, meta.last_inbound_note, meta.last_note];
  let notesSnippet: string | null = null;
  for (const n of noteCandidates) {
    if (typeof n === "string" && n.trim()) {
      notesSnippet = n.trim().slice(0, 500);
      break;
    }
  }

  return {
    company,
    stage,
    probability: probability != null && Number.isFinite(probability) ? probability : null,
    lastAction,
    notesSnippet,
  };
}
