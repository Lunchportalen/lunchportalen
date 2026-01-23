// app/api/me/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type ProfileRow = {
  role: Role | null;
  company_id: string | null;
  is_disabled: boolean | null;
};

function noStore() {
  return { "Cache-Control": "no-store, max-age=0" };
}

export async function GET() {
  const rid = `me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (!user) {
      return NextResponse.json(
        { ok: false, rid, user: null },
        { status: 401, headers: noStore() }
      );
    }

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
      return NextResponse.json(
        { ok: false, rid, error: "profile_missing", user: null },
        { status: 403, headers: noStore() }
      );
    }

    const prof = profRes.data;

    if (prof.is_disabled === true) {
      return NextResponse.json(
        { ok: false, rid, error: "access_disabled", user: null },
        { status: 403, headers: noStore() }
      );
    }

    const role: Role = (prof.role as Role) ?? "employee";

    return NextResponse.json(
      {
        ok: true,
        rid,
        user: {
          id: user.id,
          email: user.email ?? null,
          role,
          companyId: role === "superadmin" ? null : prof.company_id ?? null,
        },
      },
      { status: 200, headers: noStore() }
    );
  } catch {
    return NextResponse.json(
      { ok: false, rid, error: "me_failed", user: null },
      { status: 401, headers: noStore() }
    );
  }
}
