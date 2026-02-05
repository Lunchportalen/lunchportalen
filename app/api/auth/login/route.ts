
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";


type LoginBody = { email?: string; password?: string };

export async function POST(req: NextRequest) {
  const rid = makeRid();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonErr(rid, "Mangler Supabase ENV.", 500, "missing_env");
  }

  const hostname = req.nextUrl.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  try {
    const body = (await req.json()) as LoginBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return jsonErr(rid, "Fyll inn e-post og passord.", 400, "missing_credentials");
    }

    // ✅ ONE response to rule them all (cookies settes på denne)
    const response = jsonOk(rid, { ok: true, rid }, 200) as NextResponse;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const patched: any = { ...options };

            // ✅ Localhost over http: aldri SameSite=None + aldri Secure
            if (isLocalhost) {
              patched.secure = false;
              patched.sameSite = "lax";
              delete patched.domain;
            }

            response.cookies.set(name, value, patched);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session || !data?.user) {
      return jsonErr(rid, "Ugyldig e-post eller passord.", 401, "invalid_login");
    }

    // ✅ Returner samme response som har Set-Cookie
    return response;
  } catch (err: any) {
    console.error("[api/auth/login]", err?.message || err, { rid, err });
    return jsonErr(rid, "Kunne ikke logge inn akkurat nå. Prøv igjen.", 500, "server_error");
  }
}


