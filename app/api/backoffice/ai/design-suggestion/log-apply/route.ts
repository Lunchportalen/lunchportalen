import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

  const kind = typeof o.kind === "string" ? o.kind.trim() : "";
  if (!kind) return jsonErr(ctx.rid, "Missing kind.", 400, "BAD_REQUEST");

  const suggestionTitle = typeof o.suggestionTitle === "string" ? o.suggestionTitle.trim() : undefined;
  const pageId = typeof o.pageId === "string" ? o.pageId : null;
  const locale = o.locale === "en" ? "en" : "nb";

  try {
    const supabase = supabaseAdmin();
    await supabase.from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "design_suggestion_applied",
        page_id: pageId,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "layout_suggestions",
        environment: "preview",
        locale,
        metadata: { kind, suggestionTitle: suggestionTitle ?? undefined },
      })
    );
    const { recordSuggestionApplied } = await import("@/lib/ai/memory/recordOutcome");
    await recordSuggestionApplied(supabase, {
      pageId,
      variantId: null,
      tool: "layout_suggestions",
      appliedKeys: [kind].concat(suggestionTitle ? [suggestionTitle] : []),
      sourceRid: ctx.rid,
    });
  } catch (_) {
    return jsonErr(ctx.rid, "Failed to log apply.", 500, "LOG_APPLY_FAILED");
  }

  return jsonOk(ctx.rid, { ok: true }, 200);
}
