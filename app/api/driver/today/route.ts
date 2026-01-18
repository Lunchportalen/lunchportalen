// app/api/driver/today/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo"; // hvis du har den, ellers hardkod date

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", u.user.id)
    .maybeSingle();

  if (!me?.role || !["driver", "superadmin"].includes(me.role)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const date = osloTodayISODate?.() ?? new Date().toISOString().slice(0, 10);

  // Service role for å hente aggregert uten å gi driver direkte DB-rettigheter
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("orders")
    .select("company_id, location_id, date, tier") // tilpass feltnavn (tier/basis/luxus)
    .eq("date", date);

  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  // Hent companies/locations og legg på kontaktinfo
  const companyIds = Array.from(new Set((data ?? []).map((r: any) => r.company_id).filter(Boolean)));
  const locationIds = Array.from(new Set((data ?? []).map((r: any) => r.location_id).filter(Boolean)));

  const [companiesRes, locationsRes] = await Promise.all([
    admin.from("companies").select("id,name").in("id", companyIds),
    admin
      .from("company_locations")
      .select("id,company_id,name,address,delivery_contact_name,delivery_contact_phone,delivery_notes,delivery_window_from,delivery_window_to")
      .in("id", locationIds),
  ]);

  const companies = new Map((companiesRes.data ?? []).map((c: any) => [c.id, c]));
  const locations = new Map((locationsRes.data ?? []).map((l: any) => [l.id, l]));

  // Aggreger totals per lokasjon
  const byLoc = new Map<string, any>();
  for (const r of data ?? []) {
    const locId = r.location_id;
    if (!locId) continue;

    const loc = locations.get(locId);
    const comp = loc ? companies.get(loc.company_id) : companies.get(r.company_id);

    const key = locId;
    const cur = byLoc.get(key) || {
      date,
      companyId: loc?.company_id ?? r.company_id,
      companyName: comp?.name ?? "Ukjent firma",
      locationId: locId,
      locationName: loc?.name ?? "Lokasjon",
      address: loc?.address ?? "",
      windowFrom: loc?.delivery_window_from ?? null,
      windowTo: loc?.delivery_window_to ?? null,
      contactName: loc?.delivery_contact_name ?? null,
      contactPhone: loc?.delivery_contact_phone ?? null,
      deliveryNotes: loc?.delivery_notes ?? null,
      totals: { basis: 0, luxus: 0 },
    };

    // tilpass tier-logikk til dine verdier
    if (String(r.tier).toUpperCase() === "LUXUS") cur.totals.luxus += 1;
    else cur.totals.basis += 1;

    byLoc.set(key, cur);
  }

  return NextResponse.json({ ok: true, date, deliveries: Array.from(byLoc.values()) }, { status: 200 });
}
