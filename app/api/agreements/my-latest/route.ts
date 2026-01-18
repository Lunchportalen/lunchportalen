export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supa = await supabaseServer();
  const { data: auth, error: authErr } = await supa.auth.getUser();

  if (authErr || !auth?.user) {
    return NextResponse.json({ ok: false, error: "Ikke innlogget." }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json({ ok: false, error: "Kunne ikke hente profil.", detail: profileErr.message }, { status: 500 });
  }

  if (!profile?.company_id) {
    return NextResponse.json({ ok: false, error: "Ingen firmatilknytning funnet." }, { status: 404 });
  }

  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("agreement_json")
    .eq("id", profile.company_id)
    .single();

  if (compErr) {
    return NextResponse.json({ ok: false, error: "Kunne ikke hente firma.", detail: compErr.message }, { status: 500 });
  }

  const pdfPath = (company as any)?.agreement_json?.terms?.pdfPath as string | undefined;

  if (!pdfPath) {
    return NextResponse.json({ ok: false, error: "Ingen avtale-PDF funnet for firmaet." }, { status: 404 });
  }

  const { data, error } = await admin.storage.from("agreements").createSignedUrl(pdfPath, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: "Kunne ikke lage nedlastingslenke.", detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
