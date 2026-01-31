// app/api/auth/login-debug/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";


type LoginBody = { email?: string; password?: string };

function isLocalhostHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

// ✅ Gjør det mulig å åpne i nettleser (forklarer 405 pent)
export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      method: "GET",
      message:
        "Dette endepunktet må kalles med POST (JSON: { email, password }). Bruk curl/Postman/DevTools fetch.",
      hint: {
        curl_windows_powershell:
          'curl -i -X POST http://localhost:3000/api/auth/login-debug -H "Content-Type: application/json" -d "{`"email`":`"test1@firma.no`",`"password`":`"PASSORD`"}"',
      },
      host: req.nextUrl.host,
      proto: req.headers.get("x-forwarded-proto") || "http",
    },
    { status: 405, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const rid = `login_dbg_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        rid,
        error: "missing_env",
        message: "Mangler Supabase ENV (URL/ANON_KEY).",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
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

  // ✅ Sett cookies på responsen (slik som i login-route)
  const response = NextResponse.json(
    { ok: true, rid },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );

  try {
    const body = (await req.json()) as LoginBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          rid,
          error: "missing_credentials",
          message: "Fyll inn e-post og passord.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

            response.cookies.set(name, value, patched);
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
      responseSetCookieNames: response.cookies.getAll().map((c) => c.name),
      requestCookieNames: req.cookies.getAll().map((c) => c.name),
    };

    const res2 = NextResponse.json(out, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });

    // ✅ Kopier set-cookie fra response -> res2
    response.cookies.getAll().forEach((c) => {
      res2.cookies.set(c.name, c.value, c);
    });

    return res2;
  } catch (err: any) {
    console.error("[api/auth/login-debug]", err?.message || err, { rid, err });

    return NextResponse.json(
      {
        ok: false,
        rid,
        error: "server_error",
        message: "Debug-login feilet.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}



