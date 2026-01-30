// app/api/admin/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonErr } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { readJson } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = normEmail((body as any)?.email);
  const password = String((body as any)?.password ?? "");

  if (!email || !isEmail(email)) {
    return jsonErr(400, undefined as any, "BAD_EMAIL", "Ugyldig e-post.", { email });
  }
  if (!password || password.length < 6) {
    return jsonErr(400, undefined as any, "BAD_PASSWORD", "Ugyldig passord.");
  }

  try {
    const sb = await supabaseServer();

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return jsonErr(401, undefined as any, "LOGIN_FAILED", "Feil e-post eller passord.", {
        message: error?.message ?? "no_user",
      });
    }

    // NB: ingen tokens returneres – UI verifiserer videre via /api/admin/auth
    return new Response(
      JSON.stringify({
        ok: true,
        rid: undefined,
        user: {
          id: data.user.id,
          email: data.user.email ?? email,
        },
      }),
      {
        status: 200,
        headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
      }
    );
  } catch (e: any) {
    return jsonErr(500, undefined as any, "UNHANDLED", "Uventet feil ved innlogging.", {
      message: String(e?.message ?? e),
    });
  }
}
