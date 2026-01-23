// app/api/auth/logout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/route";

function wipeSupabaseCookies(res: NextResponse) {
  // Supabase-cookies varierer litt i navn, men starter nesten alltid med "sb-"
  // Vi sletter aggressivt alle cookies som ser ut som Supabase-auth.
  const all = res.cookies.getAll?.() ?? [];
  for (const c of all) {
    const name = c.name || "";
    if (
      name.startsWith("sb-") ||
      name.includes("supabase") ||
      name.includes("auth-token") ||
      name.includes("access-token") ||
      name.includes("refresh-token")
    ) {
      res.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
  }

  // I tillegg: slett typiske Supabase cookie-navn (treffer ofte rett)
  const common = [
    "sb-access-token",
    "sb-refresh-token",
    "supabase-auth-token",
  ];
  for (const name of common) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set("cache-control", "no-store");

  const supabase = supabaseRoute(req, res);

  // 1) normal supabase signout (skal skrive cookie-sletting via setAll)
  await supabase.auth.signOut();

  // 2) hard wipe (failsafe)
  wipeSupabaseCookies(res);

  return res;
}
