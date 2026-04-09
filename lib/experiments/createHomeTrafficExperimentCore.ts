import "server-only";

import { generateExperimentVariants } from "@/lib/ai/experimentGenerator";
import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import { opsLog } from "@/lib/ops/log";
import { trackUsage } from "@/lib/saas/billingTracker";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CreateHomeExperimentCoreResult =
  | { ok: true; experimentId: string; variantIds: string[] }
  | { ok: false; code: string; message: string };

/**
 * Creates a running traffic A/B for slug `home` from nb/preview draft (service role).
 * Used by backoffice POST /experiments/create and publish-home auto-start.
 */
export async function createHomeTrafficExperimentCore(opts: {
  rid: string;
  source: string;
}): Promise<CreateHomeExperimentCoreResult> {
  const supabase = supabaseAdmin();

  const { data: page, error: pErr } = await supabase.from("content_pages").select("id").eq("slug", "home").maybeSingle();
  if (pErr) return { ok: false, code: "DB_ERROR", message: pErr.message };
  if (!page?.id) return { ok: false, code: "NOT_FOUND", message: "Home page not found" };

  const pageId = page.id as string;

  const { data: running } = await supabase
    .from("experiments")
    .select("id")
    .eq("content_id", pageId)
    .eq("status", "running")
    .maybeSingle();
  if (running?.id) {
    return { ok: false, code: "EXPERIMENT_RUNNING", message: "A running experiment already exists for this page." };
  }

  const { data: draftVar, error: dErr } = await supabase
    .from("content_page_variants")
    .select("body")
    .eq("page_id", pageId)
    .eq("locale", "nb")
    .eq("environment", CMS_DRAFT_ENVIRONMENT)
    .maybeSingle();
  if (dErr) return { ok: false, code: "DB_ERROR", message: dErr.message };
  if (draftVar?.body == null) {
    return { ok: false, code: "NOT_FOUND", message: "Draft variant not found for home (nb/preview)." };
  }

  const originalBody = draftVar.body as Record<string, unknown>;
  const [bodyA, bodyB, bodyC] = generateExperimentVariants(originalBody);

  let expInsert = await supabase
    .from("experiments")
    .insert({ content_id: pageId, status: "running", page_id: pageId })
    .select("id")
    .single();
  if (expInsert.error) {
    const msg = expInsert.error.message ?? "";
    const missingCol = msg.includes("page_id") || expInsert.error.code === "42703";
    if (missingCol) {
      expInsert = await supabase
        .from("experiments")
        .insert({ content_id: pageId, status: "running" })
        .select("id")
        .single();
    }
  }
  if (expInsert.error || !expInsert.data?.id) {
    return { ok: false, code: "DB_ERROR", message: expInsert.error?.message ?? "Insert failed" };
  }

  const experimentId = String((expInsert.data as { id: string }).id);

  const { error: vErr } = await supabase.from("experiment_variants").insert([
    {
      experiment_id: experimentId,
      variant_id: "A",
      name: "A",
      blocks: bodyA,
      weight: 1,
    },
    {
      experiment_id: experimentId,
      variant_id: "B",
      name: "B",
      blocks: bodyB,
      weight: 1,
    },
    {
      experiment_id: experimentId,
      variant_id: "C",
      name: "C",
      blocks: bodyC,
      weight: 1,
    },
  ]);
  if (vErr) {
    await supabase.from("experiments").delete().eq("id", experimentId);
    return { ok: false, code: "DB_ERROR", message: vErr.message };
  }

  opsLog("experiment.created", {
    rid: opts.rid,
    source: opts.source,
    experimentId,
    pageId,
    variants: ["A", "B", "C"],
  });
  opsLog("experiment_created", {
    rid: opts.rid,
    source: opts.source,
    experimentId,
    pageId,
    variants: ["A", "B", "C"],
  });
  trackUsage({
    kind: "experiment_created",
    rid: opts.rid,
    source: opts.source,
    experimentId,
    variantCount: 3,
  });

  return { ok: true, experimentId, variantIds: ["A", "B", "C"] };
}
