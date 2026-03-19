// app/driver/csv/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { noStoreHeaders } from "@/lib/http/noStore";
import { osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr } from "@/lib/http/respond";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isIsoDate(v: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
}

function normalizeWindow(v: any) {
  // Slot/window skal være stabilt – men vi lar det være case-insensitive i query
  // Samtidig vil vi ikke "gjenkjenne" nye/ukjente verdier – kun trim/normalisering.
  return safeStr(v);
}

function joinPhone(country: string, phone: string) {
  const cc = safeStr(country);
  const p = safeStr(phone);
  if (!cc && !p) return "";
  if (!cc) return p;
  if (!p) return cc;
  // Sørg for at vi ikke dobler "+" eller mellomrom
  return `${cc} ${p}`.replace(/\s+/g, " ").trim();
}

/**
 * GET ?window=<slot>&date=YYYY-MM-DD
 * - Driver CSV export (read-only)
 * - Auth: driver | superadmin
 * - Uses current schema:
 *   orders: date, status, slot, note, company_id, location_id, user_id
 *   companies: id, name
 *   company_locations: id, name, company_id, delivery_contact_name/phone/country OR contact_name/phone
 *   profiles: user_id, full_name, department
 */
export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 0) Standard scope guard
  const s = await scopeOr401(req);
  if ((s as any)?.ok === false) return (s as any).res;

  const { rid, scope } = (s as any).ctx;

  // 0.1) Role gate (driver.csv)
  const roleBlock = requireRoleOr403((s as any).ctx, "driver.csv", ["driver", "superadmin"]);
  if (roleBlock) return roleBlock;

  // 0.2) Confirm cookie-session (fail-closed)
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");

  // 0.3) Admin client (service role)
  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(rid, "Service role mangler.", 500, { code: "CONFIG_ERROR", detail: { message: safeStr(e?.message ?? e) } });
  }

  const userId = safeStr((s as any).ctx?.scope?.userId);
  if (!userId) return jsonErr(rid, "Mangler bruker.", 403, "FORBIDDEN");

  const { data: prof, error: profErr } = await loadProfileByUserId(
    admin as any,
    userId,
    "company_id, location_id, disabled_at, is_active"
  );

  if (profErr || !prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
  if ((prof as any).disabled_at || (prof as any).is_active === false) {
    return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyId = safeStr((prof as any).company_id);
  const locationId = safeStr((prof as any).location_id);
  if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

  // 1) Query params
  const url = new URL(req.url);
  const windowQ = normalizeWindow(url.searchParams.get("window"));
  const qDate = safeStr(url.searchParams.get("date"));
  const today = osloTodayISODate();
  const date = qDate && isIsoDate(qDate) ? qDate : today;
  const role = safeStr(scope?.role).toLowerCase();
  if (role === "driver" && date !== today) {
    return jsonErr(rid, "Sjåfør kan kun hente CSV for i dag.", 403, { code: "FORBIDDEN_DATE", detail: { date, today } });
  }

  if (!windowQ) {
    return jsonErr(rid, "Missing window param.", 400, "MISSING_WINDOW");
  }

  // 2) Hent ordregrunnlag for dato + slot
  // Alignér med driver-stops-fasit:
  // - Kun integritets-godkjente ordre (integrity_status = "ok")
  // - Status i ACTIVE/QUEUED/PACKED/DELIVERED (driver-visningens sannhet)
  let ordersQ = admin
    .from("orders")
    .select("id, slot, note, company_id, location_id, user_id, date, status, integrity_status")
    .eq("date", date)
    .eq("integrity_status", "ok")
    .in("status", ["ACTIVE", "QUEUED", "PACKED", "DELIVERED"])
    .eq("slot", windowQ)
    .eq("company_id", companyId);

  if (locationId) ordersQ = ordersQ.eq("location_id", locationId);

  const { data: orders, error: oErr } = await ordersQ;

  if (oErr) {
    return jsonErr(rid, "Kunne ikke hente orders.", 500, {
      code: "DB_ERROR",
      detail: { message: oErr.message, code: (oErr as any).code ?? null },
    });
  }

  const rows = orders ?? [];
  // Fail-closed: kun rader med entydig firma + lokasjon (speiler driver-stops)
  const safeRows = rows.filter((o: any) => safeStr(o.company_id) && safeStr(o.location_id));

  // 3) Hvis ingen rader: returnér tom CSV med header
  const header = ["Leveringsvindu", "Firma", "Lokasjon", "Kontakt", "Telefon", "Ansatt", "Avdeling", "Notat"];

  if (!safeRows.length) {
    const csv = header.map(csvEscape).join(",") + "\n";
    return new NextResponse(csv, {
      headers: {
        ...noStoreHeaders(),
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="driver_${date}_${windowQ}.csv"`,
      },
    });
  }

  const companyIds = Array.from(new Set(safeRows.map((o: any) => o.company_id).filter(Boolean))).map(String);
  const locationIds = Array.from(new Set(safeRows.map((o: any) => o.location_id).filter(Boolean))).map(String);
  const userIds = Array.from(new Set(safeRows.map((o: any) => o.user_id).filter(Boolean))).map(String);

  // 4) Metadata i parallell
  const [companiesRes, locationsRes, profilesRes] = await Promise.all([
    companyIds.length
      ? admin.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [], error: null as any }),
    locationIds.length
      ? admin
          .from("company_locations")
          .select("id, name, company_id, delivery_contact_name, delivery_contact_phone, delivery_contact_country, contact_name, contact_phone")
          .in("id", locationIds)
      : Promise.resolve({ data: [], error: null as any }),
    userIds.length
      ? admin.from("profiles").select("user_id, full_name, department").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null as any }),
  ]);

  if (companiesRes.error)
    return jsonErr(rid, "Kunne ikke hente firmaer.", 500, { code: "DB_ERROR", detail: { message: companiesRes.error.message } });
  if (locationsRes.error)
    return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: { message: locationsRes.error.message } });
  if (profilesRes.error)
    return jsonErr(rid, "Kunne ikke hente profiler.", 500, { code: "DB_ERROR", detail: { message: profilesRes.error.message } });

  const compMap = new Map((companiesRes.data ?? []).map((c: any) => [String(c.id), c]));
  const locMap = new Map((locationsRes.data ?? []).map((l: any) => [String(l.id), l]));
  const profMap = new Map((profilesRes.data ?? []).map((p: any) => [String(p.user_id), p]));

  // 5) CSV bygg
  const csvRows = safeRows.map((o: any) => {
    const comp = compMap.get(String(o.company_id));
    const loc = locMap.get(String(o.location_id));
    const prof = profMap.get(String(o.user_id));

    const contactName = (loc as any)?.delivery_contact_name ?? (loc as any)?.contact_name ?? "";
    const contactPhone = joinPhone((loc as any)?.delivery_contact_country, (loc as any)?.delivery_contact_phone ?? (loc as any)?.contact_phone);

    return [
      windowQ,
      safeStr(comp?.name) || "",
      safeStr((loc as any)?.name) || "",
      safeStr(contactName) || "",
      contactPhone,
      safeStr((prof as any)?.full_name) || "",
      safeStr((prof as any)?.department) || "",
      safeStr(o.note) || "",
    ];
  });

  // Stabil og deterministisk rekkefølge i eksport: Firma → Lokasjon → Kontakt → Ansatt
  const sortedCsvRows = csvRows.sort((a, b) => {
    const [, aCompany, aLocation, aContact, , aEmployee] = a;
    const [, bCompany, bLocation, bContact, , bEmployee] = b;

    const c = safeStr(aCompany).localeCompare(safeStr(bCompany), "nb");
    if (c !== 0) return c;

    const l = safeStr(aLocation).localeCompare(safeStr(bLocation), "nb");
    if (l !== 0) return l;

    const k = safeStr(aContact).localeCompare(safeStr(bContact), "nb");
    if (k !== 0) return k;

    return safeStr(aEmployee).localeCompare(safeStr(bEmployee), "nb");
  });

  const csv = [header, ...sortedCsvRows].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";

  return new NextResponse(csv, {
    headers: {
      ...noStoreHeaders(),
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="driver_${date}_${windowQ}.csv"`,
    },
  });
}
