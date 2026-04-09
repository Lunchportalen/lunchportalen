/**
 * Domination loop — **kontrollert**: maks tre anbefalinger per kjøring, **ingen** automatisk utførelse.
 * Alle kjøringer logges (gap, beslutninger, resonnering) for sporbarhet og revisjon.
 */
import "server-only";

import { listCompetitors, scoreCompetitor, type Competitor } from "@/lib/domination/competitors";
import {
  detectMarketGaps,
  type MarketGapFinding,
  type OwnPerformanceSignals,
} from "@/lib/domination/marketGaps";
import { recommendActionsFromGaps, type RecommendedGapAction } from "@/lib/domination/gapActions";

/** Maks antall tiltak returnert per kjøring — ingen batch-overveldelse. */
export const MAX_ACTIONS_PER_RUN = 3;

const runLog: DominationRunRecord[] = [];

export type DominationRunRecord = {
  /** Unik kjørings-ID (sporbarhet). */
  runId: string;
  recordedAtIso: string;
  /** Antall konkurrenter i register ved kjøring. */
  competitorCount: number;
  /** Alle detekterte gap (før cap på tiltak). */
  gaps: MarketGapFinding[];
  /** Opptil {@link MAX_ACTIONS_PER_RUN} prioriterte tiltak — menneskelig gjennomgang påkrevd. */
  decisions: RecommendedGapAction[];
  /** Sammenslått resonnering (gap + signaler + tiltaksbegrunnelse). */
  reasoning: string[];
  /** Eksplisitt: ingen auto-exec. */
  executionMode: "recommendation_only";
};

function newRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Registerinndata — samme kilde som strategimodulen. */
export function getCompetitors(): Competitor[] {
  return listCompetitors();
}

/** Detekterer gap ut fra signaler + konkurrentliste. */
export function detectGaps(competitors: Competitor[], performance: OwnPerformanceSignals = {}): MarketGapFinding[] {
  return detectMarketGaps(performance, competitors);
}

/** Genererer prioriterte tiltak; begrenset til {@link MAX_ACTIONS_PER_RUN}. */
export function generateActions(gaps: MarketGapFinding[]): RecommendedGapAction[] {
  return recommendActionsFromGaps(gaps).slice(0, MAX_ACTIONS_PER_RUN);
}

export type RankedCompetitor = Competitor & {
  rank: number;
  score: number;
};

/**
 * Snapshot til UI/API — **uten** append til kjøringslogg (unngå støy ved hver poll).
 */
export function getDominationSnapshot(performance?: OwnPerformanceSignals): {
  competitors: RankedCompetitor[];
  gaps: MarketGapFinding[];
  actions: RecommendedGapAction[];
} {
  const competitors = getCompetitors();
  const gaps = detectGaps(competitors, performance ?? {});
  const actions = generateActions(gaps);
  const ranked: RankedCompetitor[] = [...competitors]
    .map((c) => ({ c, score: scoreCompetitor(c).score }))
    .sort((a, b) => b.score - a.score)
    .map((x, i) => ({
      ...x.c,
      strengths: [...x.c.strengths],
      weaknesses: [...x.c.weaknesses],
      evidence: x.c.evidence ? [...x.c.evidence] : undefined,
      rank: i + 1,
      score: x.score,
    }));
  return { competitors: ranked, gaps, actions };
}

function buildReasoning(gaps: MarketGapFinding[], decisions: RecommendedGapAction[]): string[] {
  const lines: string[] = [
    `[run] ${gaps.length} gap detektert; ${decisions.length} tiltak returnert (cap=${MAX_ACTIONS_PER_RUN}).`,
    "Ingen automatisk utførelse — anbefalinger krever menneskelig godkjenning.",
  ];
  for (const g of gaps) {
    lines.push(`[gap:${g.id}] ${g.gap} (konfidens ${g.confidence.toFixed(3)}, potensial ${g.potentialImpact})`);
    for (const s of g.signalsUsed) lines.push(`  signal: ${s}`);
  }
  for (const d of decisions) {
    lines.push(
      `[decision:${d.gapId}] ${d.action} | effekt ${d.expectedImpact}, innsats ${d.effort}, risiko ${d.risk}`,
    );
    for (const r of d.rationale) lines.push(`  ${r}`);
  }
  return lines;
}

/**
 * Én full runde: hent konkurrenter → detekter gap → generer opptil tre tiltak → **logg alt** → returner tiltak.
 *
 * @param performance Valgfrie egne signaler; utelates brukes tom objekt (kun konkurrent-relative regler kan da fyre).
 */
export function runDomination(performance?: OwnPerformanceSignals): RecommendedGapAction[] {
  const competitors = getCompetitors();
  const gaps = detectGaps(competitors, performance ?? {});
  const actions = generateActions(gaps);
  const runId = newRunId();
  const recordedAtIso = new Date().toISOString();
  const reasoning = buildReasoning(gaps, actions);

  const record: DominationRunRecord = {
    runId,
    recordedAtIso,
    competitorCount: competitors.length,
    gaps: gaps.map((g) => ({ ...g, signalsUsed: [...g.signalsUsed] })),
    decisions: actions.map((a) => ({ ...a, rationale: [...a.rationale] })),
    reasoning,
    executionMode: "recommendation_only",
  };

  runLog.push(record);
  return actions.map((a) => ({ ...a, rationale: [...a.rationale] }));
}

/** Full sporbar logg (nyeste sist). Kun server-side minne — persistens er eksplisitt senere. */
export function getDominationLog(): readonly DominationRunRecord[] {
  return runLog;
}

/** Siste kjøring eller `undefined`. */
export function getLastDominationRun(): DominationRunRecord | undefined {
  return runLog.length ? runLog[runLog.length - 1] : undefined;
}

/** Nullstill logg (f.eks. tester). */
export function clearDominationLog(): void {
  runLog.length = 0;
}
