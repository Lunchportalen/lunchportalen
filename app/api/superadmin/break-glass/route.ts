// app/api/superadmin/break-glass/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { getActiveBreakGlass, isActiveSession, requirePurpose } from "@/lib/superadmin/breakGlass";

function denyResponse(s: any): Response {
  if (s && typeof s === "object") {
    if ("response" in s && s.response instanceof Response) return s.response as Response;
    if ("res" in s && s.res instanceof Response) return s.res as Response;
  }
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

async function writeMeta(ctx: { rid: string; scope: any }, action: string, purpose?: string | null, detail?: any) {
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
    await sb.from("audit_meta_events").insert({
      actor_user_id: ctx?.scope?.userId ?? null,
      actor_email: ctx?.scope?.email ?? null,
      action,
      purpose: purpose ?? null,
      entity_type: "SYSTEM",
      entity_id: "BREAK_GLASS",
      rid: ctx?.rid ?? null,
      detail: detail ?? null,
    });
  } catch {
    // best effort – skal ikke stoppe drift
  }
}

/* =========================================================
   GET: status
========================================================= */
export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.break-glass.GET", ["superadmin"]);
  if (deny) return deny;

  const userId = ctx.scope?.userId ?? null;
  if (!userId) return jsonErr(401, ctx, "UNAUTHENTICATED", "Du må være innlogget.");

  try {
    const active = await getActiveBreakGlass(userId);
    return jsonOk(ctx, { ok: true, rid: ctx.rid, active: active ?? null }, 200);
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Kunne ikke hente break-glass status.", {
      message: String(e?.message ?? e),
    });
  }
}

/* =========================================================
   POST: start
========================================================= */
export async function POST(req: NextRequest): Promise<Response> {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.break-glass.POST", ["superadmin"]);
  if (deny) return deny;

  const userId = ctx.scope?.userId ?? null;
  if (!userId) return jsonErr(401, ctx, "UNAUTHENTICATED", "Du må være innlogget.");

  const body = (await readJson(req)) ?? {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonErr(400, ctx, "BAD_REQUEST", "Ugyldig body.");
  }

  let purpose: string;
  try {
    purpose = requirePurpose((body as any)?.purpose);
  } catch (e: any) {
    return jsonErr(400, ctx, "BAD_REQUEST", "Du må velge formål (purpose).", {
      message: String(e?.message ?? e),
    });
  }

  const note = String((body as any)?.note ?? "").trim() || null;
  const minutes = 15; // fasit

  try {
    const existing = await getActiveBreakGlass(userId);
    if (existing && isActiveSession(existing)) {
      return jsonOk(ctx, { ok: true, rid: ctx.rid, active: existing, alreadyActive: true }, 200);
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + minutes * 60_000);

    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("break_glass_sessions")
      .insert({
        actor_user_id: userId,
        actor_email: ctx.scope?.email ?? null,
        purpose,
        note,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select("id,actor_user_id,actor_email,purpose,note,started_at,expires_at,ended_at")
      .maybeSingle();

    if (error) return jsonErr(500, ctx, "DB_ERROR", "Kunne ikke starte break-glass.", error);

    await writeMeta(ctx, "BREAK_GLASS_START", purpose, { minutes, note });

    return jsonOk(ctx, { ok: true, rid: ctx.rid, active: data ?? null }, 200);
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Kunne ikke starte break-glass.", {
      message: String(e?.message ?? e),
    });
  }
}

/* =========================================================
   DELETE: end
========================================================= */
export async function DELETE(req: NextRequest): Promise<Response> {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.break-glass.DELETE", ["superadmin"]);
  if (deny) return deny;

  const userId = ctx.scope?.userId ?? null;
  if (!userId) return jsonErr(401, ctx, "UNAUTHENTICATED", "Du må være innlogget.");

  try {
    const active = await getActiveBreakGlass(userId);
    if (!active) {
      return jsonOk(ctx, { ok: true, rid: ctx.rid, ended: false, active: null }, 200);
    }

    const sb = await supabaseServer();
    const { error } = await sb
      .from("break_glass_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", (active as any).id);

    if (error) return jsonErr(500, ctx, "DB_ERROR", "Kunne ikke avslutte break-glass.", error);

    await writeMeta(ctx, "BREAK_GLASS_END", String((active as any)?.purpose ?? null), { id: (active as any).id });

    return jsonOk(ctx, { ok: true, rid: ctx.rid, ended: true, active: null }, 200);
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Kunne ikke avslutte break-glass.", {
      message: String(e?.message ?? e),
    });
  }
}
