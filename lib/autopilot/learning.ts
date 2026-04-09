/**
 * Explainable experiment memory: deterministic aggregation only — no ML, no hidden weights.
 * Process-local ring buffer; same limits as the experiment engine (serverless = per-isolate).
 */
import "server-only";

import { logAutopilot } from "@/lib/autopilot/log";

/** Outcome shape matches {@link Experiment.result} from the experiment engine. */
export type ExperimentOutcome = {
  winner: "A" | "B";
  confidence: number;
  impact: number;
};

/** Minimal experiment snapshot for learning (no coupling to full Experiment class). */
export type ExperimentSnapshotForLearning = {
  id: string;
  type: "price" | "copy" | "ui";
  target: string;
  variantA: unknown;
  variantB: unknown;
};

export type LearningRecord = {
  experimentId: string;
  type: "price" | "copy" | "ui";
  target: string;
  /** Human-readable variant summaries (sorted keys, truncated) — not a black box. */
  variantALabel: string;
  variantBLabel: string;
  result: ExperimentOutcome;
  storedAt: number;
  /** One-line deterministic explanation of why this row exists. */
  explain: string;
};

const MAX_RECORDS = 500;
const LOW_CONFIDENCE_THRESHOLD = 0.15;
const records: LearningRecord[] = [];

function variantLabel(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v !== "object" || Array.isArray(v)) {
    const s = JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  if (!keys.length) return "{}";
  return keys
    .map((k) => {
      const val = o[k];
      const vs =
        typeof val === "object" && val !== null ? JSON.stringify(val) : String(val);
      const t = vs.length > 48 ? `${vs.slice(0, 45)}…` : vs;
      return `${k}=${t}`;
    })
    .join(", ");
}

function buildExplain(
  exp: ExperimentSnapshotForLearning,
  result: ExperimentOutcome,
): string {
  const w = result.winner;
  const side = w === "A" ? "baseline (A)" : "challenger (B)";
  return (
    `Eksperiment ${exp.id}: type=${exp.type}, mål=${exp.target}. ` +
    `Vinner: ${side} med confidence=${result.confidence.toFixed(4)}, impact=${result.impact.toFixed(4)} ` +
    `(deterministisk score fra motor — se evaluateExperiment).`
  );
}

/**
 * Stores a **completed** experiment outcome for later aggregation.
 * Idempotent per call-site: duplicate experiment ids append another row (caller should avoid double-store).
 */
export function storeResult(exp: ExperimentSnapshotForLearning, result: ExperimentOutcome): void {
  if (!exp?.id?.trim()) return;
  if (!result || (result.winner !== "A" && result.winner !== "B")) return;

  const row: LearningRecord = {
    experimentId: exp.id.trim(),
    type: exp.type,
    target: exp.target.trim(),
    variantALabel: variantLabel(exp.variantA),
    variantBLabel: variantLabel(exp.variantB),
    result: {
      winner: result.winner,
      confidence: result.confidence,
      impact: result.impact,
    },
    storedAt: Date.now(),
    explain: buildExplain(exp, result),
  };

  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i]!.experimentId === row.experimentId) records.splice(i, 1);
  }
  records.push(row);
  while (records.length > MAX_RECORDS) records.shift();

  void logAutopilot({
    kind: "autopilot_learning_stored",
    rid: `learn_${Date.now().toString(36)}`,
    payload: {
      experimentId: row.experimentId,
      type: row.type,
      winner: row.result.winner,
      explain: row.explain,
    },
  });
}

export type StrategyPerType = {
  preferredSide: "A" | "B" | "tie";
  /** Plain-language, auditable reason with counts. */
  reason: string;
  winsA: number;
  winsB: number;
  total: number;
};

export type LearningFeedback = {
  bestStrategy: {
    /** Per experiment family: which side won more often (simple plurality). */
    byExperimentType: Record<"price" | "copy" | "ui", StrategyPerType>;
  };
  /** Outcomes that look strong (winner B with positive impact or high confidence). */
  whatWorked: string[];
  /** Weak or ambiguous outcomes (low confidence or negative impact). */
  whatFailed: string[];
  /** Short, evidence-backed patterns — each ties to stored rows / counts. */
  learnedPatterns: { pattern: string; evidence: string }[];
};

function emptyStrategy(total: number): StrategyPerType {
  return {
    preferredSide: "tie",
    reason:
      total === 0
        ? "Ingen lagrede resultater ennå — kjør og fullfør eksperimenter først."
        : "Uavgjort (samme antall seire A og B).",
    winsA: 0,
    winsB: 0,
    total,
  };
}

function aggregateByType(type: "price" | "copy" | "ui"): StrategyPerType {
  const subset = records.filter((r) => r.type === type);
  const total = subset.length;
  if (!total) return emptyStrategy(0);

  let winsA = 0;
  let winsB = 0;
  for (const r of subset) {
    if (r.result.winner === "A") winsA += 1;
    else winsB += 1;
  }

  let preferredSide: "A" | "B" | "tie" = "tie";
  if (winsA > winsB) preferredSide = "A";
  else if (winsB > winsA) preferredSide = "B";

  const reason =
    preferredSide === "tie"
      ? `Type «${type}»: A vant ${winsA}×, B vant ${winsB}× (n=${total}) — uavgjort.`
      : `Type «${type}»: flertall for variant ${preferredSide === "A" ? "A (baseline)" : "B (challenger)"} med ${preferredSide === "A" ? winsA : winsB} seir(er) mot ${preferredSide === "A" ? winsB : winsA} (n=${total}).`;

  return { preferredSide, reason, winsA, winsB, total };
}

function buildWhatWorked(): string[] {
  const out: string[] = [];
  for (const r of records) {
    if (r.result.confidence >= LOW_CONFIDENCE_THRESHOLD && r.result.impact >= 0) {
      out.push(
        `${r.type}: seier ${r.result.winner} (confidence ${r.result.confidence.toFixed(2)}) — ${r.experimentId.slice(0, 16)}…`,
      );
    }
  }
  return out.slice(-50);
}

function buildWhatFailed(): string[] {
  const out: string[] = [];
  for (const r of records) {
    if (r.result.confidence < LOW_CONFIDENCE_THRESHOLD) {
      out.push(
        `Lav tillit (${r.result.confidence.toFixed(3)} < ${LOW_CONFIDENCE_THRESHOLD}): ${r.type} · ${r.experimentId.slice(0, 16)}… — vinner ${r.result.winner}`,
      );
    }
    if (r.result.impact < 0) {
      out.push(
        `Negativ impact (${r.result.impact.toFixed(3)}): ${r.type} · ${r.experimentId.slice(0, 16)}… — vinner ${r.result.winner} (må tolkes forsiktig)`,
      );
    }
  }
  return out.slice(-50);
}

function buildLearnedPatterns(): { pattern: string; evidence: string }[] {
  const patterns: { pattern: string; evidence: string }[] = [];
  for (const t of ["copy", "price", "ui"] as const) {
    const s = aggregateByType(t);
    if (s.total === 0) continue;
    if (s.preferredSide === "tie") {
      patterns.push({
        pattern: `Ingen klar retning for ${t}-eksperimenter ennå`,
        evidence: s.reason,
      });
    } else {
      patterns.push({
        pattern: `Foretrekk variant ${s.preferredSide} for type=${t} (flertall i lagret historikk)`,
        evidence: s.reason,
      });
    }
  }
  return patterns;
}

/**
 * Analyserer lagrede utfall med **enkle, forklarbare regler** (telling og terskler).
 * Ingen modell — samme input gir samme output (deterministisk).
 */
export function getBestStrategy(): LearningFeedback {
  const byExperimentType = {
    price: aggregateByType("price"),
    copy: aggregateByType("copy"),
    ui: aggregateByType("ui"),
  };

  return {
    bestStrategy: { byExperimentType },
    whatWorked: buildWhatWorked(),
    whatFailed: buildWhatFailed(),
    learnedPatterns: buildLearnedPatterns(),
  };
}

/** Read-only: current learning buffer (for tests / diagnostics). */
export function getLearningRecordsSnapshot(): readonly LearningRecord[] {
  return [...records];
}
