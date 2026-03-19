import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { getLayoutSuggestions } from "@/lib/ai/tools/layoutSuggestions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseBlocks(raw: unknown): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({
      id: String(b.id),
      type: String(b.type),
      data: b.data != null && typeof b.data === "object" && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : undefined,
    }));
}

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;
  if (!isAIEnabled()) return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

  const blocks = parseBlocks(o.blocks);
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const hasBlocks = blocks.length > 0;
  const hasTitle = title.length > 0;
  if (!hasBlocks && !hasTitle) {
    return jsonErr(ctx.rid, "Missing both blocks and title; provide blocks or title for context.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const { suggestions, message } = getLayoutSuggestions({
    blocks,
    title: hasTitle ? title : undefined,
    locale,
  });

  const responsePayload = { suggestions, message };
  const prepared = prepareAiResponseForClient(responsePayload);
  if (!prepared.ok) {
    return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
  }

  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "design_suggestions_generated",
        page_id: typeof o.pageId === "string" ? o.pageId : null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "layout_suggestions",
        environment: "preview",
        locale,
        metadata: { count: suggestions.length },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "layout-suggestions", action: "design_suggestions_generated", error: error.message });
    }
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("ai_activity_log.insert_failed", { route: "layout-suggestions", action: "design_suggestions_generated", error: e instanceof Error ? e.message : String(e) });
  }

  return jsonOk(ctx.rid, prepared.data, 200);
}
