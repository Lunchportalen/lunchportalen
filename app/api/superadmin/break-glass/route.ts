// app/api/superadmin/break-glass/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope } from "@/lib/auth/scope";
import { getActiveBreakGlass, isActiveSession, requirePurpose } from "@/lib/superadmin/breakGlass";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function rid() {
  return crypto.randomBytes(8).toString("hex");
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

async function requireSuperadmin(req: NextRequest) {
  const scope = await getScope(req);
  if (!scope?.user_id) throw new Error("NOT_AUTHENTICATED");
  if (scope.role !== "superadmin") throw new Error("FORBIDDEN");
  return scope;
}

async function writeMeta(action: string, scope: any, purpose?: string | null, detail?: any, rid?: string) {
  try {
    const sb = await supabaseServer();
    await sb.from("audit_meta_events").insert({
      actor_user_id: scope?.user_id ?? null,
      actor_email: scope?.email ?? null,
      action,
      purpose: purpose ?? null,
      entity_type: "SYSTEM",
      entity_id: "BREAK_GLASS",
      rid: rid ?? null,
      detail: detail ?? null,
    });
  } catch {
    // best effort – skal ikke stoppe drift
  }
}

export async function GET(req: NextRequest) {
  const r = rid();
  try {
    const scope = await requireSuperadmin(req);
    const active = await getActiveBreakGlass(scope.user_id);
    return jsonOk({ ok: true, rid: r, active: active ?? null });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "NOT_AUTHENTICATED") return jsonErr(401, r, "UNAUTHENTICATED", "Du må være innlogget.");
    if (msg === "FORBIDDEN") return jsonErr(403, r, "FORBIDDEN", "Kun superadmin har tilgang.");
    return jsonErr(500, r, "SERVER_ERROR", "Kunne ikke hente break-glass status.", { msg });
  }
}

export async function POST(req: NextRequest) {
  const r = rid();
  try {
    const scope = await requireSuperadmin(req);
    const body = await req.json().catch(() => ({}));

    const purpose = requirePurpose(body?.purpose);
    const note = String(body?.note ?? "").trim() || null;
    const minutes = 15; // fasit for nå

    const existing = await getActiveBreakGlass(scope.user_id);
    if (existing && isActiveSession(existing)) {
      return jsonOk({ ok: true, rid: r, active: existing, alreadyActive: true });
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + minutes * 60_000);

    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("break_glass_sessions")
      .insert({
        actor_user_id: scope.user_id,
        actor_email: scope.email ?? null,
        purpose,
        note,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select("id,actor_user_id,actor_email,purpose,note,started_at,expires_at,ended_at")
      .maybeSingle();

    if (error) return jsonErr(500, r, "DB_ERROR", "Kunne ikke starte break-glass.", error);

    await writeMeta("BREAK_GLASS_START", scope, purpose, { minutes, note }, r);

    return jsonOk({ ok: true, rid: r, active: data ?? null });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "NOT_AUTHENTICATED") return jsonErr(401, r, "UNAUTHENTICATED", "Du må være innlogget.");
    if (msg === "FORBIDDEN") return jsonErr(403, r, "FORBIDDEN", "Kun superadmin har tilgang.");
    if (msg === "PURPOSE_REQUIRED") return jsonErr(400, r, "BAD_REQUEST", "Du må velge formål (purpose).");
    return jsonErr(500, r, "SERVER_ERROR", "Kunne ikke starte break-glass.", { msg });
  }
}

export async function DELETE(req: NextRequest) {
  const r = rid();
  try {
    const scope = await requireSuperadmin(req);

    const active = await getActiveBreakGlass(scope.user_id);
    if (!active) {
      return jsonOk({ ok: true, rid: r, ended: false, active: null });
    }

    const sb = await supabaseServer();
    const { error } = await sb
      .from("break_glass_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);

    if (error) return jsonErr(500, r, "DB_ERROR", "Kunne ikke avslutte break-glass.", error);

    await writeMeta("BREAK_GLASS_END", scope, String(active.purpose ?? null), { id: active.id }, r);

    return jsonOk({ ok: true, rid: r, ended: true, active: null });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "NOT_AUTHENTICATED") return jsonErr(401, r, "UNAUTHENTICATED", "Du må være innlogget.");
    if (msg === "FORBIDDEN") return jsonErr(403, r, "FORBIDDEN", "Kun superadmin har tilgang.");
    return jsonErr(500, r, "SERVER_ERROR", "Kunne ikke avslutte break-glass.", { msg });
  }
}
