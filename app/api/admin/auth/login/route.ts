// app/api/admin/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Dag-10 standard helpers
import { jsonErr } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { readJson } from "@/lib/http/routeGuard";

/* =========================================================
   Utils
========================================================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/* =========================================================
   POST /api/admin/auth/login
   - Runtime-only (bruker Supabase + env)
   - Setter session-cookie via Supabase
   - Returnerer aldri tokens i body
========================================================= */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await readJson(req);
  } catch {
    return jsonErr(400, undefined as any, "BAD_JSON", "Ugyldig JSON-body.");
  }

  const email = normEmail(body?.email);
  const password = String(body?.password ?? "");

  if (!email || !isEmail(email)) {
    return jsonErr(400, undefined as any, "BAD_EMAIL", "Ugyldig e-post.", { email });
  }
  if (!password || password.length < 6) {
    return jsonErr(400, undefined as any, "BAD_PASSWORD", "Ugyldig passord.");
  }

  try {
    const sb = await supabaseServer();

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return jsonErr(401, undefined as any, "LOGIN_FAILED", "Feil e-post eller passord.", {
        message: error?.message ?? "no_user",
      });
    }

    // NB:
    // - Supabase setter cookie automatisk
    // - UI verifiserer videre via /api/admin/auth
    return NextResponse.json(
      {
        ok: true,
        rid: undefined,
        user: {
          id: data.user.id,
          email: data.user.email ?? email,
        },
      },
      {
        status: 200,
        headers: {
          ...noStoreHeaders(),
          "content-type": "application/json; charset=utf-8",
        },
      }
    );
  } catch (e: any) {
    return jsonErr(500, undefined as any, "UNHANDLED", "Uventet feil ved innlogging.", {
      message: String(e?.message ?? e),
    });
  }
}
