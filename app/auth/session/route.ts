// app/api/auth/session/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

function jsonError(res: NextResponse, status: number, code: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, code, message, detail: detail ?? undefined }, { status, headers: res.headers });
}

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true }, { status: 200 });

  try {
    const body = await req.json().catch(() => ({}));
    const access_token = String(body?.access_token ?? "");
    const refresh_token = String(body?.refresh_token ?? "");

    if (!access_token || !refresh_token) {
      return jsonError(res, 400, "BAD_INPUT", "Mangler access_token/refresh_token");
    }

    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!supabaseUrl || !supabaseAnon) {
      return jsonError(res, 500, "MISCONFIG", "Mangler Supabase env");
    }

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // ✅ Sett cookies på response (Set-Cookie header)
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    });

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return jsonError(res, 401, "SESSION_SET_FAILED", error.message);
    }

    return res;
  } catch (e: any) {
    return jsonError(res, 500, "SERVER_ERROR", e?.message || String(e));
  }
}
