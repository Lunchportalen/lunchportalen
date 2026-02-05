// app/api/auth/me/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";


const AUTH_TIMEOUT_MS = 1500;
type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export async function GET() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();

  try {
    const supabase = await supabaseServer();

    const userRes = (await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("getUser_timeout")), AUTH_TIMEOUT_MS)
      ),
    ])) as Awaited<ReturnType<typeof supabase.auth.getUser>>;

    const user = userRes.data?.user;

    if (!user) return jsonErr(rid, "Ikke innlogget.", 401, { code: "not_authenticated", detail: { user: null } });

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

    return jsonOk(rid, {
      ok: true,
      rid,
      user: {
        id: user.id,
        email: user.email ?? null,
        role: (profile?.role as Role) || "employee",
        companyId: profile?.company_id ?? null,
      },
    }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke verifisere innlogging.", 401, { code: "auth_check_failed", detail: { user: null } });
  }
}


