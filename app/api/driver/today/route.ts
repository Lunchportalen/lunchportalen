// app/api/driver/today/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

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
 * - Read-only sjåførvisning
 * - Aggregerer pr lokasjon
 * - Tier: prøver orders.tier hvis finnes, ellers slot "lux" fallback
 * - Kun ACTIVE orders (Avensia: én sannhet)
 */
export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 🔐 Scope + rid
  const s = await scopeOr401(req);
  if ((s as any).ok === false) return (s as any).res;

  const { rid, scope } = (s as any).ctx;

  // 🔐 Role gate (✅ send ctx, ikke rid)
  const roleBlock = requireRoleOr403((s as any).ctx, scope?.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  // ?date=YYYY-MM-DD (valgfritt)
  const u = new URL(req.url);
  const qDate = asIsoDate(u.searchParams.get("date"));
  const date = qDate ?? osloTodayISODate();

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Service role mangler.", { detail: safeStr(e?.message ?? e) });
  }

  // OBS: orders schema-fasit hos dere har ikke "tier".
  // Vi prøver "tier" (hvis dere har lagt det til), ellers bruker vi slot som fallback.
  // Viktig: Supabase feiler hvis vi selekterer en kolonne som ikke finnes.
  // Derfor: prøv med tier først, og fallback til uten tier ved column-error.
  let orders: any[] = [];
  try {
    const { data, error } = await admin
      .from("orders")
      .select("company_id,location_id,date,slot,tier,status")
      .eq("date", date)
      .eq("status", "ACTIVE");

    if (error) {
      // fallback ved "column tier does not exist"
      const msg = safeStr((error as any).message).toLowerCase();
      const maybeMissingTier =
        msg.includes("column") && msg.includes("tier") && (msg.includes("does not exist") || msg.includes("not exist"));

      if (!maybeMissingTier) {
        return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre for sjåførvisning.", {
          message: (error as any).message,
          code: (error as any).code,
          detail: (error as any).details,
        });
      }

      const { data: data2, error: error2 } = await admin
        .from("orders")
        .select("company_id,location_id,date,slot,status")
        .eq("date", date)
        .eq("status", "ACTIVE");

      if (error2) {
        return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre for sjåførvisning.", {
          message: (error2 as any).message,
          code: (error2 as any).code,
          detail: (error2 as any).details,
        });
      }

      orders = data2 ?? [];
    } else {
      orders = data ?? [];
    }
  } catch (e: any) {
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre for sjåførvisning.", { detail: safeStr(e?.message ?? e) });
  }

  const rows = orders ?? [];

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
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente firmaer.", {
      message: companiesRes.error.message,
      code: companiesRes.error.code,
    });
  }

  if (locationsRes.error) {
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente lokasjoner.", {
      message: locationsRes.error.message,
      code: locationsRes.error.code,
    });
  }

  const companies = new Map((companiesRes.data ?? []).map((c: any) => [String(c.id), c]));
  const locations = new Map((locationsRes.data ?? []).map((l: any) => [String(l.id), l]));

  const byLoc = new Map<string, Delivery>();

  for (const r of rows) {
    const locId = String((r as any).location_id ?? "").trim();
    if (!isUuid(locId)) continue;

    const loc = locations.get(locId);
    const companyId = String(loc?.company_id ?? (r as any).company_id ?? "").trim();
    const comp = companies.get(companyId);

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

    const tierRaw = safeStr((r as any).tier);
    const slotRaw = safeStr((r as any).slot);

    const tierUpper = tierRaw ? tierRaw.toUpperCase() : "";
    const isLux =
      tierUpper === "LUXUS" ||
      tierUpper === "LUX" ||
      (!tierUpper && slotRaw.toLowerCase().includes("lux"));

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

  return jsonOk({ ok: true, rid, date, deliveries } satisfies ApiOk, 200);
}


