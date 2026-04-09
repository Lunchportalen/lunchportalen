import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { runContentHealthDaily } from "@/lib/ai/agents/contentHealthDaily";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";

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
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const locale = o.locale === "en" ? "en" : "nb";
  const limitPages = typeof o.limitPages === "number" ? Math.min(200, Math.max(1, o.limitPages)) : 200;

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const result = await runContentHealthDaily(supabaseAdmin(), { locale, limitPages });

  return jsonOk(ctx.rid, { ok: true, scanned: result.scanned, written: result.written }, 200);
  });
}