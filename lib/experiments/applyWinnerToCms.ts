import "server-only";

import { recordPageContentVersion } from "@/lib/backoffice/content/pageVersionsRepo";
import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import { toPageBodyFromBlocks } from "@/lib/experiments/rollout";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ApplyWinnerResult = { ok: true } | { ok: false; message: string };

/**
 * Writes winning experiment blocks into CMS variants. Preview always updated when safe; prod only when `applyProd`.
 * Stores resolution_meta on the experiment row for audit / manual rollback.
 */
export async function applyExperimentWinnerToCms(opts: {
  experimentId: string;
  winnerVariantId: string;
  applyProd: boolean;
  rid: string;
}): Promise<ApplyWinnerResult> {
  const eid = String(opts.experimentId ?? "").trim();
  const wid = String(opts.winnerVariantId ?? "").trim();
  if (!eid || !wid) return { ok: false, message: "Missing experiment or variant id" };

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: exp, error: eErr } = await supabase
    .from("experiments")
    .select("id,content_id,status,resolution_meta")
    .eq("id", eid)
    .maybeSingle();
  if (eErr || !exp) return { ok: false, message: eErr?.message ?? "Experiment not found" };
  if ((exp as { status: string }).status !== "running") {
    return { ok: false, message: "Experiment is not running" };
  }

  const pageId = String((exp as { content_id: string }).content_id ?? "").trim();
  if (!pageId) return { ok: false, message: "Experiment missing content_id" };

  const { data: vRow, error: vErr } = await supabase
    .from("experiment_variants")
    .select("blocks")
    .eq("experiment_id", eid)
    .eq("variant_id", wid)
    .maybeSingle();
  if (vErr || !vRow) return { ok: false, message: vErr?.message ?? "Winner variant not found" };

  const blocks = (vRow as { blocks: unknown }).blocks;
  const bodyPayload = toPageBodyFromBlocks(blocks) as Record<string, unknown>;

  const { data: prevPreview } = await supabase
    .from("content_page_variants")
    .select("body")
    .eq("page_id", pageId)
    .eq("locale", "nb")
    .eq("environment", CMS_DRAFT_ENVIRONMENT)
    .maybeSingle();

  const { data: prevProd } = await supabase
    .from("content_page_variants")
    .select("body")
    .eq("page_id", pageId)
    .eq("locale", "nb")
    .eq("environment", "prod")
    .maybeSingle();

  const snapshot = {
    rid: opts.rid,
    winnerVariantId: wid,
    resolvedAt: now,
    previewBodyBefore: prevPreview?.body ?? null,
    prodBodyBefore: prevProd?.body ?? null,
    applyProd: opts.applyProd,
  };

  const { error: upPreviewErr } = await supabase.from("content_page_variants").upsert(
    {
      page_id: pageId,
      locale: "nb",
      environment: CMS_DRAFT_ENVIRONMENT,
      body: bodyPayload,
      updated_at: now,
    },
    { onConflict: "page_id,locale,environment" },
  );
  if (upPreviewErr) {
    opsLog("experiment.apply_winner.error", { experimentId: eid, phase: "preview", message: upPreviewErr.message });
    return { ok: false, message: upPreviewErr.message };
  }

  try {
    await recordPageContentVersion(supabase as any, {
      pageId,
      locale: "nb",
      environment: CMS_DRAFT_ENVIRONMENT,
      createdBy: null,
      label: "Eksperimentvinner anvendt",
      action: "save",
      changedFields: ["Forhåndsvisning"],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("experiment.apply_winner.error", { experimentId: eid, phase: "version_preview", message });
    return { ok: false, message };
  }

  if (opts.applyProd) {
    const { error: upProdErr } = await supabase.from("content_page_variants").upsert(
      {
        page_id: pageId,
        locale: "nb",
        environment: "prod",
        body: bodyPayload,
        updated_at: now,
      },
      { onConflict: "page_id,locale,environment" },
    );
    if (upProdErr) {
      opsLog("experiment.apply_winner.error", { experimentId: eid, phase: "prod", message: upProdErr.message });
      return { ok: false, message: upProdErr.message };
    }

    try {
      await recordPageContentVersion(supabase as any, {
        pageId,
        locale: "nb",
        environment: "prod",
        createdBy: null,
        label: "Eksperimentvinner anvendt",
        action: "save",
        changedFields: ["Produksjon"],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("experiment.apply_winner.error", { experimentId: eid, phase: "version_prod", message });
      return { ok: false, message };
    }
  }

  const prevMeta =
    exp.resolution_meta && typeof exp.resolution_meta === "object" && !Array.isArray(exp.resolution_meta)
      ? (exp.resolution_meta as Record<string, unknown>)
      : {};

  const { error: exUpErr } = await supabase
    .from("experiments")
    .update({
      status: "completed",
      resolution_meta: { ...prevMeta, lastResolution: snapshot },
    })
    .eq("id", eid);
  if (exUpErr) {
    opsLog("experiment.apply_winner.error", { experimentId: eid, phase: "complete_experiment", message: exUpErr.message });
    return { ok: false, message: exUpErr.message };
  }

  await supabase.from("content_pages").update({ updated_at: now }).eq("id", pageId);

  opsLog("experiment.apply_winner.done", {
    experimentId: eid,
    winnerVariantId: wid,
    pageId,
    applyProd: opts.applyProd,
    rid: opts.rid,
  });

  return { ok: true };
}
