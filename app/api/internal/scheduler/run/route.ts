import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { executeRelease } from "@/lib/backoffice/content/releasesRepo";
import { getWorkflow } from "@/lib/backoffice/content/workflowRepo";

export async function POST(request: NextRequest) {
  const rid = makeRid("sched");
  try {
    requireCronAuth(request);
  } catch (e: any) {
    const code = String(e?.code ?? "").trim();
    const msg = String(e?.message ?? e);
    if (code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET er ikke satt i environment.", 500, "misconfigured");
    }
    if (code === "forbidden" || msg === "forbidden") {
      return jsonErr(rid, "Ugyldig eller manglende cron secret.", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i scheduler-gate.", 500, { code: "server_error", detail: { message: msg } });
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: variants } = await supabase
      .from("content_page_variants")
      .select("id, page_id");
    const list = Array.isArray(variants) ? variants : [];
    let published = 0;
    let skipped = 0;
    for (const v of list) {
      for (const env of ["prod", "staging"] as const) {
        for (const locale of ["nb", "en"] as const) {
          if (env === "staging") {
            published++;
            continue;
          }
          const workflow = await getWorkflow(supabase as any, v.id, env, locale);
          if (workflow.state === "approved") published++;
          else skipped++;
        }
      }
    }
    const now = new Date().toISOString();
    const { data: dueReleases } = await supabase
      .from("content_releases")
      .select("id")
      .eq("status", "scheduled")
      .lte("publish_at", now);
    const releases = Array.isArray(dueReleases) ? dueReleases : [];
    let releaseExecutedCount = 0;
    for (const r of releases) {
      const result = await executeRelease(supabase as any, r.id, null);
      releaseExecutedCount += result.count;
    }
    return jsonOk(rid, { ok: true, rid, published, skipped, releaseExecutedCount }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}