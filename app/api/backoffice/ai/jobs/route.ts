import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  try {
    const supabase = supabaseAdmin();
    const { data: rows, error } = await supabase
      .from("ai_jobs")
      .select("id, tool, status, attempts, max_attempts, next_run_at, created_at, error")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[SUPABASE_JOBS_ERROR]", error);
      return jsonErr(ctx.rid, "Kunne ikke hente jobs.", 500, "JOBS_FETCH_FAILED", error);
    }

    return jsonOk(ctx.rid, { jobs: rows ?? [] }, 200);
  } catch (error) {
    console.error("[AI_JOBS_ERROR]", error);
    const message = error instanceof Error ? error.message : "Ukjent feil ved henting av jobs.";
    return jsonErr(ctx.rid, message, 500, "AI_JOBS_FAILED", error);
  }
}