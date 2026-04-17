// app/api/driver/today/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";
import { loadProfileByUserId } from "@/lib/db/profileLookup";
import { loadOperativeKitchenOrders } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { fetchProductionOperativeSnapshotAllowlist } from "@/lib/server/kitchen/fetchProductionOperativeSnapshotAllowlist";

const allowedRoles = ["driver", "superadmin"] as const;

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function asIsoDate(d: any) {
  const s = safeStr(d);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

type Delivery = {
  locationId: string;

  companyName: string;
  locationName: string;
  address: string;

  totals: { basis: number; luxus: number };

  windowFrom: string | null;
  windowTo: string | null;

  contactName: string | null;
  contactPhone: string | null;

  deliveryNotes: string | null;
};

type ApiOk = { ok: true; rid: string; date: string; deliveries: Delivery[] };

/**
 * GET /api/driver/today?date=YYYY-MM-DD
 * - Read-only sjåførvisning, samme operative ordregrunnlag som GET /api/kitchen (ACTIVE + day_choices)
 * - Aggregerer pr lokasjon; basis/luxus-hevristikk kun fra slot-tekst (som kjøkken uten tier-kolonne)
 */
export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 🔐 Scope + rid
  const s = await scopeOr401(req);
  if ((s as any).ok === false) return (s as any).res;

  const { rid, scope } = (s as any).ctx;

  const roleBlock = requireRoleOr403((s as any).ctx, [...allowedRoles]);
  if (roleBlock) return roleBlock;

  // ?date=YYYY-MM-DD (valgfritt)
  const u = new URL(req.url);
  const qDate = asIsoDate(u.searchParams.get("date"));
  const today = osloTodayISODate();
  const role = safeStr(scope?.role).toLowerCase();
  if (role === "driver" && qDate && qDate !== today) {
    return jsonErr(rid, "Sjåfør kan kun hente dagens leveranser.", 403, { code: "FORBIDDEN_DATE", detail: { date: qDate, today } });
  }
  const date = role === "driver" ? today : qDate ?? today;

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(rid, "Service role mangler.", 500, { code: "CONFIG_ERROR", detail: { detail: safeStr(e?.message ?? e) } });
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

  const snap = await fetchProductionOperativeSnapshotAllowlist(admin as any, { dateISO: date, companyId });
  const productionFreezeAllowlist = snap.found ? snap.orderIds : undefined;

  const loaded = await loadOperativeKitchenOrders({
    admin: admin as any,
    dateISO: date,
    tenant: { companyId, locationId: locationId || null },
    productionFreezeAllowlist,
  });
  if (loaded.ok === false) {
    return jsonErr(rid, "Kunne ikke hente ordre for sjåførvisning.", 500, {
      code: "DB_ERROR",
      detail: { message: loaded.dbError.message, code: loaded.dbError.code },
    });
  }

  const rows = loaded.operative;

  const companyIds = Array.from(
    new Set(rows.map((r: any) => String(r.company_id ?? "").trim()).filter((x) => isUuid(x)))
  );
  const locationIds = Array.from(
    new Set(rows.map((r: any) => String(r.location_id ?? "").trim()).filter((x) => isUuid(x)))
  );

  const [companiesRes, locationsRes] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id,name").in("id", companyIds) : Promise.resolve({ data: [] as any[], error: null as any }),
    locationIds.length
      ? admin
          .from("company_locations")
          .select(
            // støtter både dine felt og typiske varianter (fail-soft)
            "id,company_id,name,address,delivery_contact_name,delivery_contact_phone,delivery_notes,delivery_window_from,delivery_window_to,contact_name,contact_phone"
          )
          .in("id", locationIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);

  if (companiesRes.error) {
    return jsonErr(rid, "Kunne ikke hente firmaer.", 500, { code: "DB_ERROR", detail: {
      message: companiesRes.error.message,
      code: companiesRes.error.code,
    } });
  }

  if (locationsRes.error) {
    return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: {
      message: locationsRes.error.message,
      code: locationsRes.error.code,
    } });
  }

  const companyRows = Array.isArray(companiesRes.data) ? companiesRes.data : [];
  const locationRows = Array.isArray(locationsRes.data) ? locationsRes.data : [];
  const companies = new Map(companyRows.map((c: any) => [String(c.id), c]));
  const locations = new Map(locationRows.map((l: any) => [String(l.id), l]));

  const byLoc = new Map<string, Delivery>();

  for (const r of rows) {
    const locId = String((r as any).location_id ?? "").trim();
    if (!isUuid(locId)) continue;

    const loc = locations.get(locId);
    const rowCompanyId = String(loc?.company_id ?? (r as any).company_id ?? "").trim();
    const comp = companies.get(rowCompanyId);

    const cur =
      byLoc.get(locId) ??
      ({
        locationId: locId,
        companyName: safeStr(comp?.name) || "Ukjent firma",
        locationName: safeStr(loc?.name) || "Lokasjon",
        address: safeStr(loc?.address),

        windowFrom: (loc as any)?.delivery_window_from ?? null,
        windowTo: (loc as any)?.delivery_window_to ?? null,

        // støtt begge feltsett
        contactName: (loc as any)?.delivery_contact_name ?? (loc as any)?.contact_name ?? null,
        contactPhone: (loc as any)?.delivery_contact_phone ?? (loc as any)?.contact_phone ?? null,

        deliveryNotes: (loc as any)?.delivery_notes ?? null,

        totals: { basis: 0, luxus: 0 },
      } satisfies Delivery);

    const slotRaw = safeStr((r as any).slot);
    const isLux = slotRaw.toLowerCase().includes("lux");

    if (isLux) cur.totals.luxus += 1;
    else cur.totals.basis += 1;

    byLoc.set(locId, cur);
  }

  const deliveries = Array.from(byLoc.values());

  deliveries.sort((a, b) => {
    const c = a.companyName.localeCompare(b.companyName, "nb");
    if (c !== 0) return c;
    return a.locationName.localeCompare(b.locationName, "nb");
  });

  return jsonOk(rid, { date, deliveries } satisfies Omit<ApiOk, "ok" | "rid">);
}


