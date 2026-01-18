// app/api/profile/set-scope/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function isUuid(v: any) {
  return typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.role || !["superadmin", "company_admin", "employee"].includes(profile.role)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const companyId = body?.companyId;
  const locationId = body?.locationId;

  if (!isUuid(companyId) || !isUuid(locationId)) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "MISSING_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const admin = supabaseAdmin();

  // Valider at location tilhører company
  const { data: loc, error: locErr } = await admin
    .from("company_locations")
    .select("id,company_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locErr || !loc || loc.company_id !== companyId) {
    return NextResponse.json({ ok: false, error: "INVALID_SCOPE" }, { status: 400 });
  }

  // Oppdater kun egen profil (user_id match)
  const { error: upErr } = await admin
    .from("profiles")
    .update({ company_id: companyId, location_id: locationId })
    .eq("user_id", user.id);

  if (upErr) {
    return NextResponse.json({ ok: false, error: "UPDATE_FAILED", message: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
