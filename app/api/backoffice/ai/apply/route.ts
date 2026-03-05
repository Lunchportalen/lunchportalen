import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

const METADATA_MAX = 2000;

function truncateForMetadata(obj: unknown): unknown {
  const s = JSON.stringify(obj);
  if (s.length <= METADATA_MAX) return obj;
  return { _truncated: true, length: s.length, preview: s.slice(0, METADATA_MAX) };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
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
    await supabase.from("ai_activity_log").insert({
      page_id: (o.pageId as string) ?? null,
      variant_id: (o.variantId as string) ?? null,
      environment: env,
      locale,
      action: "apply",
      tool: tool || "apply",
      created_by: ctx.scope?.email ?? null,
      metadata: truncateForMetadata({ applied }) as Record<string, unknown>,
    });
  } catch (_) {
    // best-effort log, non-fatal
  }

  return jsonOk(ctx.rid, { ok: true, rid: ctx.rid }, 200);
}