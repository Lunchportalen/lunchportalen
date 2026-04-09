import "server-only";

import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { applyExperimentWinnerToCms } from "@/lib/experiments/applyWinnerToCms";
import { validateWinnerAppliedToProd } from "@/lib/experiments/validateWinnerAppliedToProd";
import { explorationBandFromImpressions } from "@/lib/moo/exploration";
import { collectVariantMetricsFromDb } from "@/lib/moo/collectVariantMetricsFromDb";
import { revenueConsistencyOk } from "@/lib/moo/mooConsistency";
import { getMooMinImpressionsPerVariant } from "@/lib/moo/mooConfig";
import { logMooDecision } from "@/lib/moo/logMooDecision";
import { buildMooMetrics } from "@/lib/moo/metrics";
import { normalize } from "@/lib/moo/normalize";
import { score } from "@/lib/moo/score";
import { DEFAULT_GROWTH_SOFT_GATE, isGrowthSoftWinner } from "@/lib/moo/softPareto";
import { isMooCooldownActive } from "@/lib/moo/safety";
import type { MooNormalized, MooRawMetrics } from "@/lib/moo/types";
import { opsLog } from "@/lib/ops/log";
import type { SupabaseClient } from "@supabase/supabase-js";

function countImpressionsForVariant(
  rows: { event_type?: string | null; variant_id?: string | null }[] | null | undefined,
  variantId: string,
): number {
  let n = 0;
  for (const raw of rows ?? []) {
    if (String(raw?.variant_id ?? "") !== variantId) continue;
    const et = String(raw?.event_type ?? "");
    if (et === "view" || et === "impression") n += 1;
  }
  return n;
}

export type RunMooResolveResult = {
  mode: "moo";
  resolved: string[];
  skipped: string[];
  validationFailed: string[];
  experimentId: string;
  decision: "soft_winner" | "keep_a" | "skipped" | null;
  scoreDelta: number | null;
  metricsBefore: MooNormalized | null;
  metricsAfter: MooNormalized | null;
  winnerVariantId: string | null;
  skipReason?: string;
  explorationBand?: string;
  killSwitchExcluded?: string[];
  consistencyOk?: boolean;
};

export type RunMooBatchResult = {
  mode: "moo";
  results: RunMooResolveResult[];
  resolved: string[];
  skipped: string[];
  validationFailed: string[];
  totalRunning: number;
  experimentsProcessed: number;
};

const KILL_RELATIVE_REVENUE = 0.1;

/**
 * Resolves one running experiment (MOO growth rules). Parallel runs: call {@link runMooResolveBatch}.
 */
export async function resolveMooExperimentOne(opts: {
  rid: string;
  supabase: SupabaseClient;
  experimentId: string;
}): Promise<RunMooResolveResult> {
  const { rid, supabase, experimentId } = opts;
  const empty = (eid: string): RunMooResolveResult => ({
    mode: "moo",
    resolved: [],
    skipped: [],
    validationFailed: [],
    experimentId: eid,
    decision: null,
    scoreDelta: null,
    metricsBefore: null,
    metricsAfter: null,
    winnerVariantId: null,
  });

  const { data: expRow, error: expErr } = await supabase
    .from("experiments")
    .select("id,content_id,created_at")
    .eq("id", experimentId)
    .maybeSingle();
  if (expErr || !expRow) {
    return { ...empty(experimentId), skipped: [experimentId], skipReason: "experiment_load" };
  }

  const pageId = String((expRow as { content_id?: string }).content_id ?? "").trim();
  const sinceIso = String((expRow as { created_at?: string }).created_at ?? new Date(0).toISOString());
  const startedAtMs = Date.parse(sinceIso);
  const learningSeconds = Number.isFinite(startedAtMs) ? Math.max(0, (Date.now() - startedAtMs) / 1000) : 0;

  if (!pageId) {
    return { ...empty(experimentId), skipped: [experimentId], skipReason: "missing_page" };
  }

  const cooldown = await isMooCooldownActive(supabase, pageId, Date.now());
  if (cooldown) {
    opsLog("moo.resolve.cooldown", { rid, experimentId, pageId });
    return { ...empty(experimentId), skipped: [experimentId], skipReason: "cooldown_active" };
  }

  const { data: vRows } = await supabase.from("experiment_variants").select("variant_id").eq("experiment_id", experimentId);
  const vids = new Set((vRows ?? []).map((r) => String((r as { variant_id?: string }).variant_id ?? "")));
  if (!vids.has("A") || !vids.has("B")) {
    return { ...empty(experimentId), skipped: [experimentId], skipReason: "missing_ab_variants" };
  }

  const { data: evAll } = await supabase
    .from("experiment_events")
    .select("event_type,variant_id")
    .eq("experiment_id", experimentId)
    .gte("created_at", sinceIso);

  const ev = evAll as { event_type?: string | null; variant_id?: string | null }[] | undefined;

  const variantOrder = ["A", "B", "C"].filter((vid) => vids.has(vid));
  const impByVariant: Record<string, number> = {};
  for (const vid of variantOrder) {
    impByVariant[vid] = countImpressionsForVariant(ev, vid);
  }

  const minImp = getMooMinImpressionsPerVariant();

  for (const vid of variantOrder) {
    if (impByVariant[vid]! < minImp) {
      opsLog("moo.resolve.low_sample", { rid, experimentId, impByVariant, min: minImp });
      await logMooDecision({
        rid,
        experimentId,
        pageId,
        metadata: {
          before: null,
          after: null,
          scoreBefore: 0,
          scoreAfter: 0,
          applied: false,
          winnerVariantId: null,
          normalizedA: null,
          normalizedB: null,
          rawA: null,
          rawB: null,
          reason: "LOW_SAMPLE",
        },
      });
      return {
        ...empty(experimentId),
        skipped: [experimentId],
        skipReason: "low_sample",
        decision: "skipped",
      };
    }
  }

  const rawByVariant: Record<string, MooRawMetrics> = {};
  for (const vid of variantOrder) {
    const raw = await collectVariantMetricsFromDb({ experimentId, variantId: vid, pageId, sinceIso });
    rawByVariant[vid] = buildMooMetrics(raw);
  }

  const rawA = rawByVariant["A"]!;
  const killExcluded: string[] = [];
  for (const cid of variantOrder) {
    if (cid === "A") continue;
    const r = rawByVariant[cid]!;
    if (rawA.revenue > 0 && r.revenue < rawA.revenue * (1 - KILL_RELATIVE_REVENUE)) {
      killExcluded.push(cid);
      opsLog("moo.kill_switch", {
        rid,
        experimentId,
        variantId: cid,
        revenueA: rawA.revenue,
        revenueVariant: r.revenue,
        threshold: 1 - KILL_RELATIVE_REVENUE,
      });
    }
  }

  const nByVariant: Record<string, MooNormalized> = {};
  for (const vid of variantOrder) {
    nByVariant[vid] = normalize(rawByVariant[vid]!);
  }

  const nA = nByVariant["A"]!;
  const scoreBefore = score(nA);

  const totalImpressions = variantOrder.reduce((s, vid) => s + (impByVariant[vid] ?? 0), 0);
  const explorationBand = explorationBandFromImpressions({
    totalImpressions,
    minPerVariant: minImp,
    variantCount: variantOrder.length,
  });

  const candidates = variantOrder.filter((v) => v !== "A").filter((cid) => !killExcluded.includes(cid));

  const passing: { id: string; n: MooNormalized; revenue: number }[] = [];
  for (const cid of candidates) {
    const n = nByVariant[cid]!;
    if (isGrowthSoftWinner(nA, n, DEFAULT_GROWTH_SOFT_GATE)) {
      passing.push({ id: cid, n, revenue: n.revenue });
    }
  }

  let winnerVariantId: string;
  if (passing.length === 0) {
    winnerVariantId = "A";
  } else {
    passing.sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return score(b.n) - score(a.n);
    });
    winnerVariantId = passing[0]!.id;
  }

  let consistencyOk = true;
  if (winnerVariantId !== "A") {
    consistencyOk = await revenueConsistencyOk({
      supabase,
      experimentId,
      winnerVariantId,
      baselineVariantId: "A",
    });
    if (!consistencyOk) {
      opsLog("moo.consistency_fail", { rid, experimentId, attemptedWinner: winnerVariantId });
      winnerVariantId = "A";
    }
  }

  const decision: RunMooResolveResult["decision"] = winnerVariantId !== "A" ? "soft_winner" : "keep_a";
  const nWinner = nByVariant[winnerVariantId]!;
  const scoreAfter = score(nWinner);
  const scoreDelta = scoreAfter - scoreBefore;

  opsLog("moo.resolve.metrics", {
    rid,
    experimentId,
    rawByVariant,
    normalizedByVariant: nByVariant,
    scoreBefore,
    scoreAfter,
    scoreDelta,
    winnerVariantId,
    explorationBand,
    growthGate: true,
    killSwitchExcluded: killExcluded,
    consistencyOk,
  });

  opsLog("moo.learning", {
    rid,
    experimentId,
    pageId,
    learningSeconds,
    explorationBand,
    impressions: impByVariant,
    minImpressions: minImp,
  });

  const applied = await withCmsPageDocumentGate("api/cron/resolve-experiments/MOO", async () =>
    applyExperimentWinnerToCms({
      experimentId,
      winnerVariantId,
      applyProd: true,
      rid,
    }),
  );

  let prodValidated = false;
  if (applied.ok) {
    const v = await validateWinnerAppliedToProd({ experimentId, pageId, winnerVariantId });
    prodValidated = v.ok;
    if (!v.ok) {
      opsLog("moo.resolve.validation_failed", { rid, experimentId, pageId, detail: v.detail });
    }
  }

  const rawB = rawByVariant["B"];
  const rawC = rawByVariant["C"];

  await logMooDecision({
    rid,
    experimentId,
    pageId,
    metadata: {
      before: rawA,
      after: rawByVariant[winnerVariantId],
      scoreBefore,
      scoreAfter,
      applied: applied.ok === true,
      winnerVariantId,
      normalizedA: nA,
      normalizedB: nByVariant["B"] ?? null,
      rawA,
      rawB: rawB ?? null,
      normalizedC: nByVariant["C"] ?? undefined,
      rawC: rawC ?? undefined,
      softPareto: true,
      confidenceBand: explorationBand,
      minRevenueGainNormalized: DEFAULT_GROWTH_SOFT_GATE.minRelativeRevenueGain,
      candidatesEvaluated: candidates,
      reason:
        applied.ok === true
          ? prodValidated
            ? "ok"
            : "apply_ok_validation_warn"
          : applied.ok === false
            ? applied.message
            : "unknown",
    },
  });

  if (applied.ok) {
    opsLog("auto_apply", {
      rid,
      experimentId,
      winnerVariantId,
      pageId,
      applyProd: true,
      prodValidated,
      thresholdMet: true,
      engine: "moo",
      explorationBand,
      learningSeconds,
    });
    const validationFailed = prodValidated ? [] : [experimentId];
    return {
      mode: "moo",
      resolved: [experimentId],
      skipped: [],
      validationFailed,
      experimentId,
      decision,
      scoreDelta,
      metricsBefore: nA,
      metricsAfter: nWinner,
      winnerVariantId,
      explorationBand,
      killSwitchExcluded: killExcluded,
      consistencyOk,
    };
  }

  return {
    ...empty(experimentId),
    skipped: [experimentId],
    experimentId,
    decision: "skipped",
    scoreDelta,
    metricsBefore: nA,
    metricsAfter: nWinner,
    winnerVariantId,
    explorationBand,
    killSwitchExcluded: killExcluded,
    consistencyOk,
    skipReason: applied.ok === false ? applied.message : "apply_failed",
  };
}

/**
 * One experiment per page allowed; multiple pages can run in parallel — processes every running experiment.
 */
export async function runMooResolveBatch(opts: { rid: string; supabase: SupabaseClient }): Promise<RunMooBatchResult> {
  const { rid, supabase } = opts;
  const { data: running, error: listErr } = await supabase.from("experiments").select("id").eq("status", "running");
  if (listErr) {
    opsLog("moo.resolve.error", { rid, message: listErr.message });
    return {
      mode: "moo",
      results: [],
      resolved: [],
      skipped: [],
      validationFailed: [],
      totalRunning: 0,
      experimentsProcessed: 0,
    };
  }

  const results: RunMooResolveResult[] = [];
  for (const row of running ?? []) {
    const experimentId = String((row as { id: string }).id ?? "").trim();
    if (!experimentId) continue;
    const r = await resolveMooExperimentOne({ rid, supabase, experimentId });
    results.push(r);
  }

  const resolved = results.flatMap((r) => r.resolved);
  const skipped = results.flatMap((r) => r.skipped);
  const validationFailed = results.flatMap((r) => r.validationFailed);

  opsLog("moo.batch_done", {
    rid,
    experimentsProcessed: results.length,
    resolvedCount: resolved.length,
    skippedCount: skipped.length,
  });

  return {
    mode: "moo",
    results,
    resolved,
    skipped,
    validationFailed,
    totalRunning: (running ?? []).length,
    experimentsProcessed: results.length,
  };
}

/** @deprecated Prefer {@link runMooResolveBatch} for parallel page experiments. */
export async function runMooResolveSingle(opts: { rid: string; supabase: SupabaseClient }): Promise<RunMooBatchResult> {
  return runMooResolveBatch(opts);
}
