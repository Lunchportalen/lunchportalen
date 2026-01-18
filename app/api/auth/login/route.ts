import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

type LoginBody = { email?: string; password?: string };

export async function POST(req: NextRequest) {
  const rid = `login_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, rid, error: "missing_env", message: "Mangler Supabase ENV." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const hostname = req.nextUrl.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  try {
    const body = (await req.json()) as LoginBody;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, rid, error: "missing_credentials", message: "Fyll inn e-post og passord." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ ONE response to rule them all (cookies settes på denne)
    const response = NextResponse.json(
      { ok: true, rid },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );

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
      return NextResponse.json(
        { ok: false, rid, error: "invalid_login", message: "Ugyldig e-post eller passord." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ Returner samme response som har Set-Cookie
    return response;
  } catch (err: any) {
    console.error("[api/auth/login]", err?.message || err, { rid, err });
    return NextResponse.json(
      { ok: false, rid, error: "server_error", message: "Kunne ikke logge inn akkurat nå. Prøv igjen." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
