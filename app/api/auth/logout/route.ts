// app/api/auth/logout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
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

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    const payload = { ok: true as const, rid, data: { loggedOut: true } };
    const res = jsonOk(rid, payload, 200) as NextResponse;
    const supabase = supabaseRoute(req, res);

    // 1) normal supabase signout (skal skrive cookie-sletting via setAll)
    await supabase.auth.signOut();

    // 2) hard wipe (failsafe)
    wipeSupabaseCookies(res);

    return res;
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke logge ut.", 500, { code: "LOGOUT_FAILED", detail: {
      message: String(e?.message ?? e ?? "unknown"),
    } });
  }
}
