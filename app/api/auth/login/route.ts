// app/api/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

type LoginBody = { email?: string; password?: string };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function applyNoStore(res: NextResponse) {
  const h = noStoreHeaders() as Record<string, string>;
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  res.headers.set("content-type", "application/json; charset=utf-8");
  res.headers.set("x-content-type-options", "nosniff");
  return res;
}

function ok(rid: string, data: unknown, status = 200) {
  return applyNoStore(NextResponse.json({ ok: true, rid, data }, { status }));
}

function err(rid: string, message: string, status: number, code: string, detail?: unknown) {
  return applyNoStore(
    NextResponse.json(
      { ok: false, rid, error: code, message, status, ...(detail ? { detail } : {}) },
      { status }
    )
  );
}

function isProbablyJson(req: NextRequest) {
  const ct = String(req.headers.get("content-type") ?? "").toLowerCase();
  return ct.includes("application/json");
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return err(rid, "Mangler Supabase ENV.", 500, "missing_env", {
      missing: [
        !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
        !supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
      ].filter(Boolean),
    });
  }

  const hostname = req.nextUrl.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  // Capture cookies from Supabase, apply ONLY on success
  const capturedCookies: Array<{ name: string; value: string; options?: any }> = [];

  try {
    let body: LoginBody | null = null;

    if (isProbablyJson(req)) {
      body = (await req.json().catch(() => null)) as LoginBody | null;
    } else {
      // If someone posts form-encoded, fail deterministically
      return err(rid, "Ugyldig innholdstype. Bruk application/json.", 415, "unsupported_media_type");
    }

    const email = safeStr(body?.email).toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return err(rid, "Fyll inn e-post og passord.", 400, "missing_credentials");
    }

    // SSR client that reads incoming cookies and *captures* outgoing cookies
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            capturedCookies.push({ name, value, options });
          }
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session || !data?.user?.id) {
      // No cookie leakage on failed auth
      return err(rid, "Ugyldig e-post eller passord.", 401, "invalid_login");
    }

    // Success response
    const res = ok(
      rid,
      {
        user_id: data.user.id,
      },
      200
    );

    // Apply cookies only now (success)
    for (const c of capturedCookies) {
      const patched: any = { ...(c.options ?? {}) };

      // Local dev: avoid secure+domain pitfalls
      if (isLocalhost) {
        patched.secure = false;
        patched.sameSite = "lax";
        delete patched.domain;
      } else {
        // Production: keep secure cookies; default to lax if unset
        if (patched.secure === undefined) patched.secure = true;
        if (patched.sameSite === undefined) patched.sameSite = "lax";
      }

      res.cookies.set(c.name, c.value, patched);
    }

    return res;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[api/auth/login]", e?.stack || e?.message || e, { rid });
    return err(rid, "Kunne ikke logge inn akkurat nå. Prøv igjen.", 500, "server_error");
  }
}
