/**
 * Deterministiske sannsynligheter per pipeline-trinn fra faktiske utfall (won/lost),
 * uten AI eller tilfeldighet. Forklarbar og repeterbar.
 */

export const PIPELINE_STAGES = ["new", "contacted", "meeting", "proposal", "won", "lost"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type LeadPipelineLike = {
  id?: string;
  status?: string | null;
  meta?: Record<string, unknown> | null;
};

/** Normaliserer eksisterende verdier (f.eks. legacy "lead" fra upsertLead) til kanoniske trinn. */
export function normalizePipelineStage(raw: unknown): PipelineStage {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "" || s === "lead") return "new";
  if (PIPELINE_STAGES.includes(s as PipelineStage)) return s as PipelineStage;
  return "new";
}

export type StageProbabilityStats = {
  /** Andel vunnet blant avsluttede (won+lost) — reell konverteringsrate. */
  globalWinRate: number;
  terminalWon: number;
  terminalLost: number;
  /** Per trinn: { total, won } der won = treff på terminal won i dette trinnet (typisk kun for "won"). */
  byStage: Record<string, { total: number; won: number }>;
};

/**
 * Beregner empiriske sannsynligheter per `meta.pipeline_stage`.
 *
 * - **won** → 1, **lost** → 0 (deterministisk utfall).
 * - **Øvrige trinn**: hvis vi har minst ett avsluttet utfall totalt, brukes **globalWinRate**
 *   (won / (won+lost)) som estimat for åpne saker; hvis et trinn har egne treff på won i data
 *   (sjeldent), brukes won/total for det trinnet.
 *
 * Ingen tilfeldighet; samme input gir samme output (idempotent beregning).
 */
export function computeStageProbabilities(leads: LeadPipelineLike[]): {
  probabilities: Record<string, number>;
  stats: StageProbabilityStats;
} {
  const list = Array.isArray(leads) ? leads : [];

  let terminalWon = 0;
  let terminalLost = 0;
  for (const lead of list) {
    const ps = normalizePipelineStage(lead.meta?.pipeline_stage);
    if (ps === "won") terminalWon++;
    else if (ps === "lost" || String(lead.status ?? "").toLowerCase() === "lost") terminalLost++;
  }

  const terminalDenom = terminalWon + terminalLost;
  const globalWinRate = terminalDenom > 0 ? terminalWon / terminalDenom : 0;

  const byStage: Record<string, { total: number; won: number }> = {};
  for (const s of PIPELINE_STAGES) {
    byStage[s] = { total: 0, won: 0 };
  }

  for (const lead of list) {
    const stage = normalizePipelineStage(lead.meta?.pipeline_stage);
    if (!byStage[stage]) byStage[stage] = { total: 0, won: 0 };
    byStage[stage].total++;
    if (normalizePipelineStage(lead.meta?.pipeline_stage) === "won") {
      byStage[stage].won++;
    }
  }

  const probabilities: Record<string, number> = {};

  for (const stage of PIPELINE_STAGES) {
    const b = byStage[stage] ?? { total: 0, won: 0 };
    if (stage === "won") {
      probabilities[stage] = 1;
      continue;
    }
    if (stage === "lost") {
      probabilities[stage] = 0;
      continue;
    }
    if (b.total === 0) {
      probabilities[stage] = globalWinRate;
      continue;
    }
    const empirical = b.won / b.total;
    probabilities[stage] = empirical > 0 ? empirical : globalWinRate;
  }

  return {
    probabilities,
    stats: {
      globalWinRate,
      terminalWon,
      terminalLost,
      byStage,
    },
  };
}
