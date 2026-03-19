import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { buildBlockFromDescription } from "@/lib/ai/tools/blockBuilder";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE, DEFAULT_AI_EDITOR_RATE_LIMIT } from "@/lib/ai/rateLimit";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;
  if (!isAIEnabled()) return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  const identity = ctx.scope?.email ?? ctx.scope?.sub ?? "anon";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:block-builder`, DEFAULT_AI_EDITOR_RATE_LIMIT);
  if (!rl.allowed) {
    const extraHeaders: HeadersInit | undefined =
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
    return jsonErr(ctx.rid, "Rate limit exceeded. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

  const description = typeof o.description === "string" ? o.description.trim() : "";
  if (!description) return jsonErr(ctx.rid, "Missing or empty description.", 400, "MISSING_DESCRIPTION");

  const preferredType = typeof o.preferredType === "string" ? o.preferredType.trim() : undefined;
  const locale = o.locale === "en" ? "en" : "nb";
  const pageId = typeof o.pageId === "string" ? o.pageId : undefined;
  const variantId = typeof o.variantId === "string" ? o.variantId : undefined;
  const context = o.context && typeof o.context === "object" && !Array.isArray(o.context) ? (o.context as Record<string, unknown>) : undefined;

  const input = {
    description,
    preferredType: preferredType || undefined,
    locale,
  };
  const { block, message } = buildBlockFromDescription(input);

  const prepared = prepareAiResponseForClient({ block, message });
  if (!prepared.ok) {
    return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
  }
  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "block_build",
        page_id: pageId ?? null,
        variant_id: variantId ?? null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "block_builder",
        environment: "preview",
        locale,
        metadata: { hasBlock: !!block },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "block-builder", action: "block_build", error: error.message });
    }
  } catch {
    // Best-effort: do not mask response
  }
  return jsonOk(ctx.rid, prepared.data, 200);
}
