import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { id } = await context.params;
  if (!id?.trim()) return jsonErr(ctx.rid, "Mangler suggestion id.", 400, "BAD_REQUEST");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  const o = body && typeof body === "object" ? (body as { status?: string }) : null;
  const status = (o?.status ?? "").trim();
  if (status !== "applied" && status !== "discarded") {
    return jsonErr(ctx.rid, "Ugyldig status.", 400, "BAD_REQUEST");
  }

  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { status };
  if (status === "applied") {
    patch.applied_at = now;
    patch.discarded_at = null;
  } else if (status === "discarded") {
    patch.discarded_at = now;
    patch.applied_at = null;
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("ai_suggestions")
      .update(patch)
      .eq("id", id);

    if (error) {
      return jsonErr(ctx.rid, "Kunne ikke oppdatere status.", 500, "AI_SUGGESTION_STATUS_FAILED", error);
    }

    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke oppdatere status.", 500, "AI_SUGGESTION_STATUS_FAILED", e);
  }
}