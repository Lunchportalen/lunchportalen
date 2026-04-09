import "server-only";

import { createHash } from "crypto";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { readPostTextAndSource } from "@/lib/revenue/model";
import { buildStandardSocialContentV1, normalizePlatform } from "@/lib/social/socialPostContent";
import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

const ROUTE = "social_ab_experiment";

export type SocialAbExperimentResult =
  | {
      ok: true;
      experimentId: string;
      variantPostIdA: string;
      variantPostIdB: string;
      status: string;
    }
  | { ok: false; error: string };

function stableBPostId(basePostId: string, experimentId: string): string {
  const h = createHash("sha256").update(`${basePostId}:${experimentId}:B`).digest("hex").slice(0, 20);
  return `ab_${basePostId.slice(0, 48)}_b_${h}`;
}

/**
 * Creates ab_experiments + two ab_variants (A = existing post, B = new draft post with variant copy).
 * Idempotent per (experimentId attempt): uses deterministic B id from hash.
 */
export async function createSocialAbExperiment(
  admin: SupabaseClient,
  params: {
    rid: string;
    basePostId: string;
    variantText: string;
    /** draft | active — caller decides from guardrails. */
    status: "draft" | "active";
  }
): Promise<SocialAbExperimentResult> {
  const expOk = await verifyTable(admin, "ab_experiments", ROUTE);
  const varOk = await verifyTable(admin, "ab_variants", ROUTE);
  const postOk = await verifyTable(admin, "social_posts", ROUTE);
  if (!expOk || !varOk || !postOk) {
    return { ok: false, error: "tables_unavailable" };
  }

  const { data: base, error: bErr } = await admin.from("social_posts").select("*").eq("id", params.basePostId).maybeSingle();
  if (bErr || !base || typeof base !== "object") {
    return { ok: false, error: "base_post_missing" };
  }

  const row = base as Record<string, unknown>;
  const { text: baseText, source: src } = readPostTextAndSource(row);
  const platform = typeof row.platform === "string" ? row.platform : "linkedin";

  const { data: insExp, error: eErr } = await admin
    .from("ab_experiments")
    .insert({
      name: `revenue_ab_${params.rid}`,
      status: params.status,
    } as Record<string, unknown>)
    .select("id")
    .single();

  if (eErr || !insExp || typeof insExp !== "object") {
    return { ok: false, error: eErr?.message ?? "experiment_insert_failed" };
  }

  const experimentId = String((insExp as { id?: unknown }).id ?? "");
  if (!experimentId) {
    return { ok: false, error: "experiment_id_missing" };
  }

  const bPostId = stableBPostId(params.basePostId, experimentId);

  const nextContent = buildStandardSocialContentV1({
    text: params.variantText.trim() || baseText.slice(0, 4000),
    hashtags: [],
    images: [],
    source: "deterministic",
    platform: normalizePlatform(platform),
    data: {
      revenueTrackingPath: `ab:${experimentId}:B`,
      link: null,
    },
  });

  const now = new Date().toISOString();
  const insPost = await admin.from("social_posts").insert({
    id: bPostId,
    content: nextContent as unknown as Record<string, unknown>,
    status: "planned",
    platform: normalizePlatform(platform),
    updated_at: now,
  } as Record<string, unknown>);

  if (insPost.error) {
    await admin.from("ab_experiments").delete().eq("id", experimentId);
    return { ok: false, error: insPost.error.message };
  }

  const { error: vErr } = await admin.from("ab_variants").insert([
    { experiment_id: experimentId, social_post_id: params.basePostId, label: "A" },
    { experiment_id: experimentId, social_post_id: bPostId, label: "B" },
  ] as Record<string, unknown>[]);

  if (vErr) {
    await admin.from("social_posts").delete().eq("id", bPostId);
    await admin.from("ab_experiments").delete().eq("id", experimentId);
    return { ok: false, error: vErr.message };
  }

  const logRow = buildAiActivityLogRow({
    action: "experiment_event",
    metadata: {
      kind: "revenue_ab_created",
      rid: params.rid,
      experiment_id: experimentId,
      base_post_id: params.basePostId,
      variant_b_post_id: bPostId,
      base_source: src,
    },
  });
  await admin.from("ai_activity_log").insert({ ...logRow, rid: params.rid, status: "success" } as Record<string, unknown>);

  opsLog("revenue_ab_experiment_created", {
    rid: params.rid,
    experimentId,
    a: params.basePostId,
    b: bPostId,
  });

  return {
    ok: true,
    experimentId,
    variantPostIdA: params.basePostId,
    variantPostIdB: bPostId,
    status: params.status,
  };
}

/** Back-compat alias for spec naming. */
export const createABTest = createSocialAbExperiment;
