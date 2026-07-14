// lib/providers/packingList.ts
//
// FASE 7 — provider-eid pakkeliste (produksjonsgrunnlag for pakking/levering).
//
// Determinisme og fail-closed:
//  - Provider-scope er absolutt: alle spørringer filtrerer på provider_id, og
//    kalleren MÅ være medlem av provideren (verifiseres i API/side — denne
//    modulen tar providerId som allerede-autorisert input).
//  - CANCELLED/PAUSED er ALDRI med (0 kansellerte porsjoner i grunnlaget).
//  - Gruppering: dato → leveringsvindu (slot) → firma → lokasjon, sortert
//    deterministisk. Oppdateringer (re-SET/kansellering) reflekteres ved neste
//    lasting siden alt leses fra orders-sannheten.
//  - Allergener: både ordrelinje-snapshots (order_items.allergens_snapshot) og
//    ansattes allergenprofil (lp_user_allergens: codes + free_text).
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const PACKING_EXCLUDED_STATUSES = ["CANCELLED", "PAUSED"] as const;

export type PackingLine = {
  orderId: string;
  status: string;
  employeeName: string | null;
  productName: string;
  quantity: number;
  allergens: string[];
  profileAllergenCodes: string[];
  profileAllergenNote: string | null;
  orderNote: string | null;
};

export type PackingLocationGroup = {
  companyId: string;
  companyName: string;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
  deliveryInstructions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  portions: number;
  productTotals: Array<{ productName: string; quantity: number }>;
  lines: PackingLine[];
};

export type PackingList = {
  providerId: string;
  date: string;
  slot: string;
  totalPortions: number;
  groups: PackingLocationGroup[];
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/** providerId MUST already be authorized for the caller (provider membership). */
export async function loadProviderPackingList(providerId: string, date: string): Promise<PackingList> {
  const pid = safeStr(providerId);
  const admin = supabaseAdmin() as any;

  const { data: orderRows, error } = await admin
    .from("orders")
    .select("id, date, slot, status, note, company_id, location_id, user_id")
    .eq("provider_id", pid)
    .eq("date", date)
    .not("status", "in", `(${PACKING_EXCLUDED_STATUSES.join(",")})`)
    .order("company_id", { ascending: true })
    .order("location_id", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`packingList: orders read failed: ${error.message}`);

  const rows = (orderRows ?? []) as Array<Record<string, unknown>>;
  const orderIds = rows.map((r) => safeStr(r.id));
  const userIds = [...new Set(rows.map((r) => safeStr(r.user_id)).filter(Boolean))];
  const companyIds = [...new Set(rows.map((r) => safeStr(r.company_id)).filter(Boolean))];
  const locationIds = [...new Set(rows.map((r) => safeStr(r.location_id)).filter(Boolean))];

  const [companiesRes, locationsRes, profilesRes, itemsRes, allergensRes] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, name").in("id", companyIds) : { data: [] },
    locationIds.length
      ? admin
          .from("company_locations")
          .select("id, name, address, delivery_instructions, contact_name, contact_phone, window_from, window_to")
          .in("id", locationIds)
      : { data: [] },
    userIds.length ? admin.from("profiles").select("id, full_name, email").in("id", userIds) : { data: [] },
    orderIds.length
      ? admin
          .from("order_items")
          .select("order_id, product_name_snapshot, quantity, allergens_snapshot")
          .in("order_id", orderIds)
      : { data: [] },
    userIds.length ? admin.from("lp_user_allergens").select("user_id, codes, free_text").in("user_id", userIds) : { data: [] },
  ]);

  const companyName = new Map<string, string>();
  for (const c of companiesRes.data ?? []) companyName.set(safeStr(c.id), safeStr(c.name) || safeStr(c.id));
  const locationById = new Map<string, Record<string, unknown>>();
  for (const l of locationsRes.data ?? []) locationById.set(safeStr(l.id), l as Record<string, unknown>);
  const profileById = new Map<string, Record<string, unknown>>();
  for (const p of profilesRes.data ?? []) profileById.set(safeStr(p.id), p as Record<string, unknown>);
  const allergenByUser = new Map<string, { codes: string[]; note: string | null }>();
  for (const a of allergensRes.data ?? []) {
    allergenByUser.set(safeStr(a.user_id), {
      codes: Array.isArray(a.codes) ? a.codes.map((c: unknown) => safeStr(c)).filter(Boolean) : [],
      note: safeStr(a.free_text) || null,
    });
  }
  const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();
  for (const it of itemsRes.data ?? []) {
    const oid = safeStr(it.order_id);
    const list = itemsByOrder.get(oid) ?? [];
    list.push(it as Record<string, unknown>);
    itemsByOrder.set(oid, list);
  }

  const groupsMap = new Map<string, PackingLocationGroup>();
  let totalPortions = 0;

  for (const r of rows) {
    const companyId = safeStr(r.company_id);
    const locationId = safeStr(r.location_id) || null;
    const key = `${companyId}|${locationId ?? ""}`;
    const loc = locationId ? locationById.get(locationId) : undefined;
    let group = groupsMap.get(key);
    if (!group) {
      group = {
        companyId,
        companyName: companyName.get(companyId) ?? companyId,
        locationId,
        locationName: loc ? safeStr(loc.name) || null : null,
        address: loc ? safeStr(loc.address) || null : null,
        deliveryInstructions: loc ? safeStr(loc.delivery_instructions) || null : null,
        contactName: loc ? safeStr(loc.contact_name) || null : null,
        contactPhone: loc ? safeStr(loc.contact_phone) || null : null,
        windowFrom: loc ? safeStr(loc.window_from) || null : null,
        windowTo: loc ? safeStr(loc.window_to) || null : null,
        portions: 0,
        productTotals: [],
        lines: [],
      };
      groupsMap.set(key, group);
    }

    const userId = safeStr(r.user_id);
    const profile = profileById.get(userId);
    const allergenProfile = allergenByUser.get(userId) ?? { codes: [], note: null };
    const items = itemsByOrder.get(safeStr(r.id)) ?? [];
    const effectiveItems = items.length
      ? items
      : [{ product_name_snapshot: "Lunsj", quantity: 1, allergens_snapshot: [] }];

    for (const it of effectiveItems) {
      const qty = Number(it.quantity ?? 1) || 1;
      const productName = safeStr(it.product_name_snapshot) || "Lunsj";
      group.lines.push({
        orderId: safeStr(r.id),
        status: safeStr(r.status).toUpperCase(),
        employeeName: profile ? safeStr(profile.full_name) || safeStr(profile.email) || null : null,
        productName,
        quantity: qty,
        allergens: Array.isArray(it.allergens_snapshot)
          ? (it.allergens_snapshot as unknown[]).map((a) => safeStr(a)).filter(Boolean)
          : [],
        profileAllergenCodes: allergenProfile.codes,
        profileAllergenNote: allergenProfile.note,
        orderNote: safeStr(r.note) || null,
      });
      group.portions += qty;
      totalPortions += qty;
    }
  }

  const groups = [...groupsMap.values()]
    .map((g) => {
      const totals = new Map<string, number>();
      for (const line of g.lines) totals.set(line.productName, (totals.get(line.productName) ?? 0) + line.quantity);
      g.productTotals = [...totals.entries()]
        .map(([productName, quantity]) => ({ productName, quantity }))
        .sort((a, b) => a.productName.localeCompare(b.productName, "nb"));
      g.lines.sort((a, b) => (a.employeeName ?? "").localeCompare(b.employeeName ?? "", "nb") || a.orderId.localeCompare(b.orderId));
      return g;
    })
    .sort(
      (a, b) =>
        a.companyName.localeCompare(b.companyName, "nb") ||
        (a.locationName ?? "").localeCompare(b.locationName ?? "", "nb"),
    );

  return { providerId: pid, date, slot: "default", totalPortions, groups };
}

/** Flat CSV (semikolon, UTF-8 BOM) for utskrift/offline bruk. */
export function packingListToCsv(list: PackingList): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "dato",
    "firma",
    "lokasjon",
    "adresse",
    "leveringsvindu",
    "leveringsinstruksjoner",
    "ansatt",
    "produkt",
    "antall",
    "allergener_ordre",
    "allergener_profil",
    "allergen_notat",
    "ordrenotat",
    "status",
  ].join(";");
  const lines: string[] = [header];
  for (const g of list.groups) {
    for (const line of g.lines) {
      lines.push(
        [
          list.date,
          esc(g.companyName),
          esc(g.locationName ?? ""),
          esc(g.address ?? ""),
          esc([g.windowFrom, g.windowTo].filter(Boolean).join("–")),
          esc(g.deliveryInstructions ?? ""),
          esc(line.employeeName ?? ""),
          esc(line.productName),
          String(line.quantity),
          esc(line.allergens.join(", ")),
          esc(line.profileAllergenCodes.join(", ")),
          esc(line.profileAllergenNote ?? ""),
          esc(line.orderNote ?? ""),
          esc(line.status),
        ].join(";"),
      );
    }
  }
  return `\ufeff${lines.join("\n")}\n`;
}
