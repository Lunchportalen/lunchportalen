// app/api/scope/options/route.ts
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

export async function GET() {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Kun roller som faktisk kan bestille / sette scope
  if (!profile?.role || !["superadmin", "company_admin", "employee"].includes(profile.role)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "MISSING_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const admin = supabaseAdmin();

  const { data: companies, error: cErr } = await admin
    .from("companies")
    .select("id,name")
    .order("name");

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

  const { data: locations, error: lErr } = await admin
    .from("company_locations")
    .select("id,company_id,name")
    .order("name");

  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, companies: companies ?? [], locations: locations ?? [] });
}
