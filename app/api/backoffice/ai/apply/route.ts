/** POST: log AI apply event to ai_activity_log. Privileged: superadmin only. Unauthenticated or wrong role fails closed (401/403). */
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

const METADATA_MAX = 2000;

function truncateForMetadata(obj: unknown): unknown {
  const s = JSON.stringify(obj);
  if (s.length <= METADATA_MAX) return obj;
  return { _truncated: true, length: s.length, preview: s.slice(0, METADATA_MAX) };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  return withApiAiEntrypoint(request, "POST", async () => {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const environment =
    o.environment === "staging" ? "staging" : o.environment === "preview" ? "preview" : "prod";
  const env = o.env === "staging" ? "staging" : o.env === "preview" ? "preview" : environment;
  const locale = o.locale === "en" ? "en" : "nb";
  const tool = typeof o.tool === "string" ? o.tool.trim() : "apply";
  const applied = o.patch != null ? o.patch : o.appliedSuggestion != null ? o.appliedSuggestion : o.applied != null ? o.applied : {};

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "apply",
        page_id: (o.pageId as string) ?? null,
        variant_id: (o.variantId as string) ?? null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: tool || "apply",
        environment: env,
        locale,
        metadata: truncateForMetadata({ applied }) as Record<string, unknown>,
      })
    );
    if (error) {
      return jsonErr(ctx.rid, "Kunne ikke logge apply.", 500, "APPLY_LOG_FAILED");
    }
    const { recordSuggestionApplied } = await import("@/lib/ai/memory/recordOutcome");
    await recordSuggestionApplied(supabase, {
      pageId: (o.pageId as string) ?? null,
      variantId: (o.variantId as string) ?? null,
      tool: tool || "apply",
      appliedKeys: applied && typeof applied === "object" && !Array.isArray(applied) ? Object.keys(applied).slice(0, 20) : undefined,
      sourceRid: ctx.rid,
    });
  } catch (_) {
    return jsonErr(ctx.rid, "Kunne ikke logge apply.", 500, "APPLY_LOG_FAILED");
  }

  return jsonOk(ctx.rid, { ok: true, rid: ctx.rid }, 200);
  });
}


