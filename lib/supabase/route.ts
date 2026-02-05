// lib/supabase/route.ts
import { createServerClient } from "@supabase/ssr";
import type { NextResponse } from "next/server";

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
 * Støtter:
 * - supabaseRoute(res)
 * - supabaseRoute(req, res)
 */
export function supabaseRoute(res: NextResponse): ReturnType<typeof createServerClient>;
export function supabaseRoute(req: Request, res: NextResponse): ReturnType<typeof createServerClient>;
export function supabaseRoute(a: Request | NextResponse, b?: NextResponse) {
  const hasReq = typeof (a as Request).headers?.get === "function";

  const req: Request | null = hasReq ? (a as Request) : null;
  const res: NextResponse | null = hasReq ? (b ?? null) : (a as NextResponse);

  const cookiesFromReq = req
    ? parseCookieHeader(req.headers.get("cookie"))
    : [];

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );
}
