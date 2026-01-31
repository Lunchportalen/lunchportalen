// app/api/admin/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function ridFrom(req: NextRequest) {
  const h = safeStr(req.headers.get("x-rid"));
  return h || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ok(rid: string, body: any, status = 200) {
  return NextResponse.json({ ok: true, rid, ...body }, { status });
}
function err(rid: string, status: number, code: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error: code, message, detail: detail ?? null }, { status });
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return err(rid, 400, "BAD_JSON", "Ugyldig JSON-body.");
  }

  const email = normEmail(body?.email);
  const password = String(body?.password ?? "");

  if (!email || !isEmail(email)) {
    return err(rid, 400, "BAD_EMAIL", "Ugyldig e-post.", { email });
  }
  if (!password || password.length < 6) {
    return err(rid, 400, "BAD_PASSWORD", "Ugyldig passord.");
  }

  try {
    // ✅ Late import: hindrer env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return err(rid, 401, "LOGIN_FAILED", "Feil e-post eller passord.", { message: error?.message ?? "no_user" });
    }

    // Supabase setter cookie-session automatisk via server-clienten.
    // Vi returnerer aldri tokens i body.
    return ok(rid, {
      user: { id: data.user.id, email: data.user.email ?? email },
      message: "Innlogget."
    });
  } catch (e: any) {
    return err(rid, 500, "UNHANDLED", "Uventet feil ved innlogging.", { message: safeStr(e?.message ?? e) });
  }
}

export async function GET(req: NextRequest) {
  const rid = ridFrom(req);
  return err(rid, 405, "method_not_allowed", "Bruk POST.", { method: "GET" });
}
