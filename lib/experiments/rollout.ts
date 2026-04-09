import "server-only";

import { calculateResults } from "@/lib/experiments/evaluator";
import type { ExperimentResults } from "@/lib/experiments/types";
import type { StatisticalWinnerResult } from "@/lib/experiments/winner";
import { selectWinner } from "@/lib/experiments/winner";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_LOCALE = "nb";
const DRAFT_ENV = "preview" as const;

export type RolloutPlan = {
  pageId: string;
  variantId: string;
  rolloutStrategy: "full" | "gradual";
  confidence: number;
  targetLocale: string;
  targetEnvironment: typeof DRAFT_ENV;
  significant: boolean;
  note: string;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** Shape experiment blocks into CMS page `body` for manual editor apply (nb/preview target per plan). */
export function toPageBodyFromBlocks(blocks: unknown): { version: number; blocks: unknown[]; meta?: Record<string, unknown> } {
  if (Array.isArray(blocks)) {
    return { version: 1, blocks, meta: { source: "experiment_rollout" } };
  }
  if (blocks && typeof blocks === "object" && !Array.isArray(blocks)) {
    const o = blocks as Record<string, unknown>;
    if (Array.isArray(o.blocks)) {
      return {
        version: typeof o.version === "number" ? o.version : 1,
        blocks: o.blocks,
        meta:
          typeof o.meta === "object" && o.meta && !Array.isArray(o.meta)
            ? (o.meta as Record<string, unknown>)
            : { source: "experiment_rollout" },
      };
    }
  }
  return { version: 1, blocks: [], meta: { source: "experiment_rollout", empty: true } };
}

/**
 * Proposal only (no persistence).
 * `gradual` is advisory when the pick is not statistically significant (e.g. admin override).
 */
export function prepareRollout(experiment: { content_id: string }, winner: StatisticalWinnerResult): RolloutPlan | null {
  const vid = winner.winnerVariantId;
  if (!vid) return null;
  const significant = winner.significant;
  return {
    pageId: String(experiment.content_id ?? "").trim(),
    variantId: vid,
    rolloutStrategy: significant ? "full" : "gradual",
    confidence: winner.confidence,
    targetLocale: DEFAULT_LOCALE,
    targetEnvironment: DRAFT_ENV,
    significant,
    note: significant
      ? "Forslag: lim inn contentPayload manuelt i CMS (nb/preview). Publisering skjer kun i redaktørflyten."
      : "Gradvis/utrygg signifikans: vurder manuelt. Ingen serverlagring her — bare forslag til redaktør.",
  };
}

async function fetchVariantBlocks(experimentId: string, variantId: string): Promise<unknown | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("experiment_variants")
    .select("blocks")
    .eq("experiment_id", experimentId)
    .eq("variant_id", variantId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { blocks: unknown }).blocks ?? null;
}

export type ExecuteRolloutResult =
  | {
      ok: true;
      mode: "prepare" | "apply";
      pageId: string;
      variantId: string;
      /** Body shape to save manually in CMS (never persisted by this module). */
      contentPayload: Record<string, unknown>;
    }
  | { ok: false; error: string };

/**
 * Resolve variant blocks into CMS-shaped payload only. No database writes (including CMS).
 * `prepare` and `apply` return the same shape; `apply` is explicit intent for editor handoff.
 */
export async function executeRollout(
  experimentId: string,
  variantId: string,
  mode: "prepare" | "apply",
): Promise<ExecuteRolloutResult> {
  const eid = String(experimentId ?? "").trim();
  const vid = String(variantId ?? "").trim();
  if (!eid || !isUuid(eid)) return { ok: false, error: "Invalid experimentId" };
  if (!vid) return { ok: false, error: "Invalid variantId" };

  const supabase = supabaseAdmin();
  const { data: exp, error: eErr } = await supabase
    .from("experiments")
    .select("id, content_id, status")
    .eq("id", eid)
    .maybeSingle();
  if (eErr) return { ok: false, error: eErr.message };
  if (!exp) return { ok: false, error: "Experiment not found" };

  const pageId = String((exp as { content_id: string }).content_id ?? "").trim();
  if (!isUuid(pageId)) return { ok: false, error: "Experiment content_id must be a page UUID" };

  const blocks = await fetchVariantBlocks(eid, vid);
  if (blocks === null) return { ok: false, error: "Fant ikke variant i eksperimentet" };

  const contentPayload = toPageBodyFromBlocks(blocks) as Record<string, unknown>;
  return { ok: true, mode, pageId, variantId: vid, contentPayload };
}

export type RolloutBundle =
  | { ok: false; error: string }
  | {
      ok: true;
      pageId: string;
      variantId: string;
      winner: StatisticalWinnerResult;
      rolloutPlan: RolloutPlan | null;
      contentPayload: Record<string, unknown>;
    };

/** Statistical (or forced) winner + CMS-shaped payload proposal; no writes. */
export async function buildRolloutBundle(
  experimentId: string,
  opts?: { forceVariantId?: string },
): Promise<RolloutBundle> {
  const eid = String(experimentId ?? "").trim();
  if (!eid || !isUuid(eid)) return { ok: false, error: "Invalid experimentId" };

  const supabase = supabaseAdmin();
  const { data: exp, error: eErr } = await supabase
    .from("experiments")
    .select("id, content_id, status")
    .eq("id", eid)
    .maybeSingle();
  if (eErr) return { ok: false, error: eErr.message };
  if (!exp) return { ok: false, error: "Experiment not found" };

  const pageId = String((exp as { content_id: string }).content_id ?? "").trim();
  if (!isUuid(pageId)) return { ok: false, error: "Experiment content_id must be a page UUID" };

  const calc = await calculateResults(eid);
  if (calc.ok === false) return { ok: false, error: calc.error };

  const results: ExperimentResults = {
    variants: calc.results.variants,
    winner: null,
  };

  const forced = typeof opts?.forceVariantId === "string" ? opts.forceVariantId.trim() : "";
  let winner: StatisticalWinnerResult;
  if (forced) {
    winner = {
      winnerVariantId: forced,
      confidence: 1,
      reason: "Manuelt tvungen variant (admin) — uten statistisk test.",
      pValue: 0,
      significant: true,
      compared: null,
      editorPrep: {
        headline: "Tvungen utrulling",
        subline: `Variant «${forced}» brukes uten signifikanstest.`,
        applyLabel: "Lim inn i CMS (preview) manuelt",
        confidencePct: "n/a",
      },
    };
  } else {
    winner = selectWinner(results);
  }

  const variantIdToUse = winner.winnerVariantId;
  if (!variantIdToUse) {
    return {
      ok: false,
      error: "Ingen vinner å rulle ut. Bruk forceVariantId for manuell utrulling, eller samle mer data.",
    };
  }

  const blocks = await fetchVariantBlocks(eid, variantIdToUse);
  if (blocks === null) return { ok: false, error: "Fant ikke blokker for valgt variant" };

  const contentPayload = toPageBodyFromBlocks(blocks) as Record<string, unknown>;
  const rolloutPlan = prepareRollout({ content_id: pageId }, winner);

  return {
    ok: true,
    pageId,
    variantId: variantIdToUse,
    winner,
    rolloutPlan,
    contentPayload,
  };
}

export type RunRolloutMode = "prepare" | "apply";

export type RunRolloutResult =
  | {
      ok: true;
      mode: RunRolloutMode;
      rolloutPlan: RolloutPlan | null;
      contentPayload: Record<string, unknown>;
      /** Always false — server never persists rollout payload. */
      applied: false;
      winner: StatisticalWinnerResult;
      pageId: string;
      variantId: string;
    }
  | { ok: false; error: string };

/** Proposal engine only: same payload for prepare/apply; editor saves CMS manually. */
export async function runRollout(
  experimentId: string,
  mode: RunRolloutMode,
  opts?: { forceVariantId?: string },
): Promise<RunRolloutResult> {
  const bundle = await buildRolloutBundle(experimentId, opts);
  if (bundle.ok === false) return bundle;

  return {
    ok: true,
    mode,
    rolloutPlan: bundle.rolloutPlan,
    contentPayload: bundle.contentPayload,
    applied: false,
    winner: bundle.winner,
    pageId: bundle.pageId,
    variantId: bundle.variantId,
  };
}
