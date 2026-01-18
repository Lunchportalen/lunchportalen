// app/api/admin/locations/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", u.user.id)
    .maybeSingle();

  if (!me?.role || !["company_admin", "superadmin"].includes(me.role)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const q = supabase
    .from("company_locations")
    .select("id,company_id,name,address,delivery_contact_name,delivery_contact_phone,delivery_notes,delivery_window_from,delivery_window_to")
    .order("name", { ascending: true });

  const { data, error } =
    me.role === "superadmin" ? await q : await q.eq("company_id", me.company_id);

  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, locations: data ?? [] }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", u.user.id)
    .maybeSingle();

  if (!me?.role || !["company_admin", "superadmin"].includes(me.role)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ ok: false }, { status: 400 });

  // Hent lokasjon for å sjekke company-scope
  const { data: loc } = await supabase
    .from("company_locations")
    .select("id,company_id")
    .eq("id", body.id)
    .maybeSingle();

  if (!loc) return NextResponse.json({ ok: false }, { status: 404 });
  if (me.role !== "superadmin" && loc.company_id !== me.company_id) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const patch = {
    delivery_contact_name: body.delivery_contact_name ?? null,
    delivery_contact_phone: body.delivery_contact_phone ?? null,
    delivery_notes: body.delivery_notes ?? null,
    delivery_window_from: body.delivery_window_from ?? null,
    delivery_window_to: body.delivery_window_to ?? null,
  };

  const { error } = await supabase
    .from("company_locations")
    .update(patch)
    .eq("id", body.id);

  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
