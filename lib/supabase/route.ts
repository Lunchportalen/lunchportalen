// lib/supabase/route.ts
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/config/env";
import type { Database } from "@/lib/types/database";

type CookieKV = { name: string; value: string };

function parseCookieHeader(header: string | null): CookieKV[] {
  if (!header) return [];
  return header
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      if (i === -1) return { name: pair, value: "" };
      return {
        name: pair.slice(0, i),
        value: pair.slice(i + 1),
      };
    });
}

/**
 * Prefer `supabaseRoute(req, res)` so the client reads the incoming `Cookie` header.
 * `supabaseRoute(res)` alone yields an empty jar (legacy / special cases only).
 */
export function supabaseRoute(res: NextResponse): SupabaseClient<Database>;
export function supabaseRoute(req: Request, res: NextResponse): SupabaseClient<Database>;
export function supabaseRoute(a: Request | NextResponse, b?: NextResponse) {
  // `NextResponse` also has `headers.get` — distinguish with `instanceof Request` (includes `NextRequest`).
  const hasReq = a instanceof Request;

  const req: Request | null = hasReq ? (a as Request) : null;
  const res: NextResponse | null = hasReq ? (b ?? null) : (a as NextResponse);

  const cookiesFromReq = req ? parseCookieHeader(req.headers.get("cookie")) : [];
  const { url, anonKey } = getSupabasePublicConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookiesFromReq;
      },
      setAll(cookiesToSet) {
        // 🔐 KRITISK: Ikke skriv cookies hvis res ikke finnes
        if (!res) return;

        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });
}
