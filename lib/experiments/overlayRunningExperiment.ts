import "server-only";

import { experimentSubjectKeyFromHeaders } from "@/lib/ai/experimentWinnerDecision";
import { assignVariant } from "@/lib/experiments/assign";
import { parseBody } from "@/lib/cms/public/parseBody";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ExperimentOverlayResult = {
  body: unknown;
  assignment: { experimentId: string; variantId: string } | null;
};

function mergeBlocksIntoBody(baseBody: unknown, blocksPayload: unknown): unknown {
  const blocks = Array.isArray(blocksPayload)
    ? blocksPayload
    : blocksPayload &&
        typeof blocksPayload === "object" &&
        !Array.isArray(blocksPayload) &&
        Array.isArray((blocksPayload as { blocks?: unknown }).blocks)
      ? (blocksPayload as { blocks: unknown[] }).blocks
      : parseBody(blocksPayload);
  if (!Array.isArray(blocks) || blocks.length === 0) return baseBody;
  const base =
    baseBody && typeof baseBody === "object" && !Array.isArray(baseBody)
      ? ({ ...(baseBody as Record<string, unknown>) } as Record<string, unknown>)
      : { version: 1 };
  return {
    ...base,
    version: typeof base.version === "number" ? base.version : 1,
    blocks,
  };
}

/**
 * When a traffic experiment is running for this page, replace rendered blocks from the assigned variant.
 * Preview mode never applies traffic (editor truth). Optional random 50/50 when `experimentUseRandomSplit`.
 */
export async function overlayRunningExperimentOnBody(opts: {
  pageId: string;
  baseBody: unknown;
  preview: boolean;
  experimentSubjectKey?: string | null;
  experimentUseRandomSplit?: boolean;
}): Promise<ExperimentOverlayResult> {
  if (opts.preview) return { body: opts.baseBody, assignment: null };

  const supabase = supabaseAdmin();
  const contentId = String(opts.pageId);

  const { data: exp, error } = await supabase
    .from("experiments")
    .select("id,status")
    .eq("content_id", contentId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !exp) return { body: opts.baseBody, assignment: null };

  const experimentId = String((exp as { id: string }).id);

  const { data: rows, error: vErr } = await supabase
    .from("experiment_variants")
    .select("variant_id,weight,blocks")
    .eq("experiment_id", experimentId);
  if (vErr || !rows?.length) return { body: opts.baseBody, assignment: null };

  const weights = (rows as { variant_id: string; weight: number }[]).map((r) => ({
    variantId: r.variant_id,
    weight: r.weight,
  }));

  let subjectKey = (opts.experimentSubjectKey ?? "").trim();
  if (!subjectKey) {
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
      const ua = h.get("user-agent") ?? "";
      if (ip || ua) subjectKey = experimentSubjectKeyFromHeaders(ip, ua);
    } catch {
      subjectKey = "";
    }
  }

  let variantId: string;
  if (opts.experimentUseRandomSplit === true && rows.length >= 2) {
    const sorted = [...(rows as { variant_id: string }[])].sort((a, b) => a.variant_id.localeCompare(b.variant_id));
    const pick = Math.floor(Math.random() * sorted.length);
    variantId = sorted[pick]!.variant_id;
    opsLog("experiment.serve.random_split", {
      experimentId,
      variantId,
      variantCount: sorted.length,
    });
  } else if (subjectKey) {
    try {
      variantId = assignVariant(experimentId, subjectKey, weights).variantId;
    } catch (e) {
      opsLog("experiment.assign_variant_failed", {
        experimentId,
        message: e instanceof Error ? e.message : String(e),
      });
      throw e instanceof Error ? e : new Error(String(e));
    }
  } else {
    return { body: opts.baseBody, assignment: null };
  }

  const row = (rows as { variant_id: string; blocks: unknown }[]).find((r) => r.variant_id === variantId);
  const nextBody = mergeBlocksIntoBody(opts.baseBody, row?.blocks ?? null);

  opsLog("experiment.serve.variant", {
    experimentId,
    variantId,
    mode: opts.experimentUseRandomSplit ? "random" : "deterministic",
  });

  return {
    body: nextBody,
    assignment: { experimentId, variantId },
  };
}

/** Assignment only (for layout script / client telemetry) — reuses same rules as overlay; preview ⇒ null. */
export async function getRunningExperimentAssignmentForPage(opts: {
  pageId: string;
  preview: boolean;
  experimentSubjectKey?: string | null;
  experimentUseRandomSplit?: boolean;
}): Promise<{ experimentId: string; variantId: string } | null> {
  const r = await overlayRunningExperimentOnBody({
    pageId: opts.pageId,
    baseBody: { version: 1, blocks: [] },
    preview: opts.preview,
    experimentSubjectKey: opts.experimentSubjectKey,
    experimentUseRandomSplit: opts.experimentUseRandomSplit,
  });
  return r.assignment;
}
