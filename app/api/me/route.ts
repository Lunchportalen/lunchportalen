// app/api/me/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";


type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type ProfileRow = {
  role: Role | null;
  company_id: string | null;
  is_disabled: boolean | null;
};

export async function GET() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();

  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (!user) return jsonErr(rid, "Ikke innlogget.", 401, { code: "AUTH_REQUIRED", detail: { user: null } });

    // ✅ Supabase query builder er "thenable" i typings.
    // Vi gjør den til en ekte Promise via Promise.resolve(...)
    const profRes = (await Promise.resolve(
      supabase
        .from("profiles")
        .select("role, company_id, is_disabled")
        .eq("user_id", user.id)
        .maybeSingle()
    )) as { data: ProfileRow | null; error: any };

    if (profRes.error || !profRes.data) {
      return jsonErr(rid, "Profil mangler.", 403, { code: "profile_missing", detail: { user: null } });
    }

    const prof = profRes.data;

    if (prof.is_disabled === true) return jsonErr(rid, "Kontoen er deaktivert.", 403, { code: "access_disabled", detail: { user: null } });

    const role: Role = (prof.role as Role) ?? "employee";

    return jsonOk(rid, {
      ok: true,
      rid,
      user: {
        id: user.id,
        email: user.email ?? null,
        role,
        companyId: role === "superadmin" ? null : prof.company_id ?? null,
      },
    }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke hente profil.", 401, { code: "me_failed", detail: { user: null } });
  }
}


