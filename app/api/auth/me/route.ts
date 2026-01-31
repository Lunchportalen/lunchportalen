// app/api/auth/me/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";


const AUTH_TIMEOUT_MS = 1500;
type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export async function GET() {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = `me_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    const supabase = await supabaseServer();

    const userRes = (await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("getUser_timeout")), AUTH_TIMEOUT_MS)
      ),
    ])) as Awaited<ReturnType<typeof supabase.auth.getUser>>;

    const user = userRes.data?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, rid, error: "not_authenticated", user: null },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const profileRes = (await Promise.race([
      supabase
        .from("profiles")
        .select("role, company_id")
        .eq("id", user.id)
        .maybeSingle(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("profile_timeout")), AUTH_TIMEOUT_MS)
      ),
    ]).catch(() => null)) as
      | { data: { role?: Role | null; company_id?: string | null } | null }
      | null;

    const profile = profileRes?.data ?? null;

    return NextResponse.json(
      {
        ok: true,
        rid,
        user: {
          id: user.id,
          email: user.email ?? null,
          role: (profile?.role as Role) || "employee",
          companyId: profile?.company_id ?? null,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, rid, error: "auth_check_failed", user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}



