// app/api/auth/profile/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function json(status: number, body: any, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...noStore(), ...(extraHeaders ?? {}) } });
}

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeRole(v: any): Role {
  const r = String(v ?? "employee");
  if (r === "superadmin" || r === "company_admin" || r === "kitchen" || r === "driver" || r === "employee") return r;
  return "employee";
}

export async function GET() {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = `authprof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const sb = await supabaseServer();
  const { data: userRes, error: userErr } = await sb.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    // behold gammel shape (profileExists)
    return json(401, { ok: false, rid, error: "AUTH_REQUIRED", message: "Ikke innlogget." });
  }

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, email, role, company_id, location_id, department, name, full_name, is_active, disabled_at, disabled_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return json(500, { ok: false, rid, error: "PROFILE_LOOKUP_FAILED", message: profErr.message });
  }

  if (!profile?.id) {
    // gammel endpoint brukte profileExists=false
    return json(202, { ok: true, rid, profileExists: false }, { "Retry-After": "1" });
  }

  // Disabled / inactive → hard stop
  if (profile.disabled_at || profile.disabled_reason) {
    return json(403, {
      ok: true,
      rid,
      profileExists: true,
      profile: {
        id: profile.id,
        role: safeRole(profile.role),
        company_id: profile.company_id,
        location_id: profile.location_id,
        is_active: profile.is_active,
        disabled_at: profile.disabled_at,
        disabled_reason: profile.disabled_reason,
      },
    });
  }

  if (profile.is_active === false) {
    return json(403, {
      ok: true,
      rid,
      profileExists: true,
      profile: {
        id: profile.id,
        role: safeRole(profile.role),
        company_id: profile.company_id,
        location_id: profile.location_id,
        is_active: profile.is_active,
        disabled_at: profile.disabled_at,
        disabled_reason: profile.disabled_reason,
      },
    });
  }

  // Pending til company_id finnes
  if (!profile.company_id) {
    return json(202, { ok: true, rid, profileExists: false }, { "Retry-After": "1" });
  }

  // Klar
  return json(200, {
    ok: true,
    rid,
    profileExists: true,
    profile: {
      id: profile.id,
      role: safeRole(profile.role),
      company_id: profile.company_id,
      location_id: profile.location_id,
      is_active: profile.is_active,
      disabled_at: profile.disabled_at,
      disabled_reason: profile.disabled_reason,
    },
  });
}



