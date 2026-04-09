// app/api/admin/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { clientIpFromRequest } from "@/lib/security/context";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { trackSecurityEvent } from "@/lib/security/monitoring";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON-body.", 400, "BAD_JSON");
  }

  const email = normEmail(body?.email);
  const password = String(body?.password ?? "");

  if (!email || !isEmail(email)) {
    return jsonErr(rid, "Ugyldig e-post.", 400, { code: "BAD_EMAIL", detail: { email } });
  }
  if (!password || password.length < 6) {
    return jsonErr(rid, "Ugyldig passord.", 400, "BAD_PASSWORD");
  }

  try {
    // ✅ Late import: hindrer env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      trackSecurityEvent({
        type: "auth.login_failed",
        severity: "warn",
        message: "Innlogging feilet",
        context: { ip: clientIpFromRequest(req) },
      });
      return jsonErr(rid, "Feil e-post eller passord.", 401, { code: "LOGIN_FAILED", detail: { message: error?.message ?? "no_user" } });
    }

    scheduleAuditEvent({
      companyId: null,
      userId: data.user.id,
      action: "auth.login.success",
      resource: "session",
      metadata: { rid, ip: clientIpFromRequest(req) },
    });

    // Supabase setter cookie-session automatisk via server-clienten.
    // Vi returnerer aldri tokens i body.
    return jsonOk(rid, {
      user: { id: data.user.id, email: data.user.email ?? email },
      message: "Innlogget."
    }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil ved innlogging.", 500, { code: "UNHANDLED", detail: { message: safeStr(e?.message ?? e) } });
  }
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST.", 405, { code: "method_not_allowed", detail: { method: "GET" } });
}
