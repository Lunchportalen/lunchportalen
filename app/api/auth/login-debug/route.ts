// app/api/auth/login-debug/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import type { Database } from "@/lib/types/database";


type LoginBody = { email?: string; password?: string };

function isLocalhostHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

// ✅ Gjør det mulig å åpne i nettleser (forklarer 405 pent)
export async function GET(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Dette endepunktet må kalles med POST (JSON: { email, password }).", 405, { code: "method_not_allowed", detail: {
    method: "GET",
    hint: {
      curl_windows_powershell:
        'curl -i -X POST http://localhost:3000/api/auth/login-debug -H "Content-Type: application/json" -d "{`"email`":`"test1@firma.no`",`"password`":`"PASSORD`"}"',
    },
    host: req.nextUrl.host,
    proto: req.headers.get("x-forwarded-proto") || "http",
  } });
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    const pub = getSupabasePublicConfig();
    supabaseUrl = pub.url;
    supabaseAnonKey = pub.anonKey;
  } catch {
    return jsonErr(rid, "Mangler Supabase ENV (URL/publiserbar nøkkel).", 500, "missing_env");
  }

  const hostname = req.nextUrl.hostname;
  const isLocalhost = isLocalhostHost(hostname);

  // ✅ Vi samler hva Supabase forsøker å sette
  const cookiesAttempted: Array<{
    name: string;
    secure?: any;
    sameSite?: any;
    domain?: any;
    path?: any;
    httpOnly?: any;
    maxAge?: any;
  }> = [];
  const stagedCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  // ✅ Sett cookies på responsen (slik som i login-route)
  const response = jsonOk(rid, { ok: true, rid }, 200) as NextResponse;

  try {
    const body = (await req.json()) as LoginBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) return jsonErr(rid, "Fyll inn e-post og passord.", 400, "missing_credentials");

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            const patched: any = { ...options };

            // ✅ Localhost: tving Lax + secure=false + ingen domain
            if (isLocalhost) {
              patched.secure = false;
              patched.sameSite = "lax";
              delete patched.domain;
            }

            cookiesAttempted.push({
              name,
              secure: patched.secure,
              sameSite: patched.sameSite,
              domain: patched.domain,
              path: patched.path,
              httpOnly: patched.httpOnly,
              maxAge: patched.maxAge,
            });

            stagedCookies.push({ name, value, options: patched });
            if (response.cookies?.set) {
              response.cookies.set(name, value, patched);
            }
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // ✅ Returner debug-info + hvilke cookies som faktisk ble satt på responsen
    const out = {
      ok: !error && !!data?.session && !!data?.user,
      rid,
      host: req.nextUrl.host,
      hostname,
      proto: req.headers.get("x-forwarded-proto") || "http",
      isLocalhost,
      auth: {
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: error?.message || null,
      },
      cookiesAttempted,
      responseSetCookieNames: stagedCookies.map((c) => c.name),
      requestCookieNames: req.cookies.getAll().map((c) => c.name),
    };

    const res2 = jsonOk(rid, out, 200) as NextResponse;

    // ✅ Kopier set-cookie fra response -> res2
    stagedCookies.forEach((cookie) => {
      res2.cookies.set(cookie.name, cookie.value, cookie.options);
    });

    return res2;
  } catch (err: any) {
    console.error("[api/auth/login-debug]", err?.message || err, { rid, err });

    return jsonErr(rid, "Debug-login feilet.", 500, "server_error");
  }
}


