// lib/kitchen/dayData.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { opsLog } from "@/lib/ops/log";
import { getMenusByMealTypes } from "@/lib/cms/getMenusByMealTypes";
import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import type { CmsMenuByMealType } from "@/lib/cms/types";

export type KitchenOrder = {
  id: string; // order id
  full_name: string;
  department: string | null;

  /**
   * ✅ Kitchen note (what to make)
   * - Prefer day_choices.choice_key + variant from day_choices.note
   * - Fallback to legacy orders.note ("choice:varmmat") if day_choices missing
   */
  note: string | null;
  /** CMS `menu` for choice_key (read-only enrichment). */
  menu_title?: string | null;
  menu_description?: string | null;
  menu_allergens?: string[];
};

export type KitchenGroup = {
  delivery_date: string;
  delivery_window: string;
  company: string;
  location: string;
  company_id: string;
  location_id: string;
  company_location_id: string;
  batch_status: "queued" | "packed" | "delivered";
  packed_at: string | null;
  delivered_at: string | null;
  orders: KitchenOrder[];
};

type OrderRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  location_id: string | null;
  date: string | null;
  note: string | null;
  created_at: string | null;
  status: string | null; // expected: "active" | "canceled"
  slot: string | null; // expected: "lunch"
};

type DayChoiceRow = {
  company_id: string;
  location_id: string;
  user_id: string;
  date: string;
  choice_key: string;
  note: string | null;
  status: string | null; // expected: "ACTIVE" | "CANCELLED" (or null)
  updated_at: string | null;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function pickString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickProfileName(p: any): string {
  const full = pickString(
    p?.full_name,
    p?.name,
    p?.display_name,
    p?.displayName,
    p?.fullName
  );
  if (full) return full;
  const first = pickString(p?.first_name, p?.firstName) || "";
  const last = pickString(p?.last_name, p?.lastName) || "";
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  const email = pickString(p?.email);
  if (email) return email;
  return "Ukjent";
}

function pickLocationName(l: any): string {
  const name = pickString(
    l?.name,
    l?.title,
    l?.label,
    l?.display_name,
    l?.displayName,
    l?.location_name,
    l?.locationName,
    l?.address_name,
    l?.addressName
  );
  if (name) return name;
  const addr = pickString(l?.address, l?.street, l?.line1);
  if (addr) return addr;
  return "Ukjent lokasjon";
}

function pickCompanyName(c: any): string {
  const name = pickString(c?.name, c?.title, c?.label, c?.display_name, c?.displayName);
  return name || "Ukjent firma";
}

function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

function batchStatusFromRow(r: any): "queued" | "packed" | "delivered" {
  const st = safeStr(r?.status).toLowerCase();
  if (r?.delivered_at) return "delivered";
  if (r?.packed_at) return "packed";
  if (st === "delivered") return "delivered";
  if (st === "packed") return "packed";
  return "queued";
}

function logOpsSummary(payload: {
  rid: string;
  date: string;
  company_id: string;
  location_id?: string | null;
  orders_total: number;
  groups_total: number;
  anomalies: Record<string, number>;
  anomaly_ids: string[];
}) {
  opsLog("kitchen.day.summary", payload);
}

/**
 * Legacy parsing:
 * - orders.note might be "choice:varmmat" or "varmmat"
 */
function parseChoiceKeyFromLegacyNote(note: string | null): string | null {
  const n = safeStr(note).toLowerCase();
  if (!n) return null;
  const m = /(?:^|\s)choice:([a-z0-9_\-]+)/i.exec(n);
  if (m?.[1]) return m[1].toLowerCase();
  if (/^[a-z0-9_\-]{2,}$/.test(n)) return n;
  return null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Variant parsing:
 * Accept:
 * - "variant||Salatbar: Skinke"
 * - "Salatbar: Skinke"
 * Prefix matches CMS `menu.title` when present, else {@link displayLabelForMealTypeKey}.
 */
function parseVariantFromNote(
  choiceKey: string,
  note: string | null,
  menuByMeal: Map<string, CmsMenuByMealType>
): string | null {
  const n = safeStr(note);
  if (!n) return null;

  const parts = n.split("||").map((x) => x.trim()).filter(Boolean);
  const payload = parts.length >= 2 ? parts.slice(1).join("||").trim() : parts[0] ?? "";

  const nk = normalizeMealTypeKey(choiceKey);
  if (nk !== "salatbar" && nk !== "paasmurt") return null;

  const label = displayLabelForMealTypeKey(nk, nk ? menuByMeal.get(nk) : null);
  if (!label) return null;

  const re = new RegExp(`^${escapeRegExp(label)}\\s*:\\s*(.+)$`, "i");
  const m = re.exec(payload);
  const v = m?.[1] ? String(m[1]).trim() : "";
  return v || null;
}

function buildKitchenNote(
  choiceKey: string | null,
  note: string | null,
  menuByMeal: Map<string, CmsMenuByMealType>
): string | null {
  const ck = safeStr(choiceKey).toLowerCase();
  if (!ck) return null;

  const nk = normalizeMealTypeKey(ck);
  const base = displayLabelForMealTypeKey(nk || ck, nk ? menuByMeal.get(nk) : null) || nk || ck;
  if (nk === "salatbar" || nk === "paasmurt") {
    const v = parseVariantFromNote(nk, note, menuByMeal);
    if (v) return `${base} (${v})`;
    return base;
  }
  return base;
}

export async function fetchKitchenDayData(args: {
  admin: SupabaseClient;
  dateISO: string;
  companyId: string;
  locationId?: string | null;
  slot?: string | null;
  rid: string;
  cutoffAtUTCISO?: string | null;
  afterCutoff?: boolean;
}) {
  const { admin, dateISO, companyId, locationId, slot, rid, cutoffAtUTCISO, afterCutoff } = args;

  // =========================================================
  // 1) Orders = SANNHET for hvem som har bestilt
  //    IMPORTANT: Do NOT query non-existent columns (e.g. integrity_status)
  // =========================================================
  let q = admin
    .from("orders")
    .select("id, user_id, company_id, location_id, date, note, created_at, status, slot")
    .eq("date", dateISO)
    .eq("company_id", companyId)
    // only active orders for kitchen list
    .in("status", ["active", "ACTIVE"])
    // default slot filter (kitchen is lunch unless explicitly asked)
    .eq("slot", slot ? slot : "lunch");

  if (locationId) q = q.eq("location_id", locationId);

  // Cutoff snapshot: show only orders created before cutoff instant (UTC ISO)
  if (afterCutoff && cutoffAtUTCISO) q = q.lte("created_at", cutoffAtUTCISO);

  q = q.order("slot", { ascending: true }).order("created_at", { ascending: true });

  const { data: orders, error: oErr } = await q;
  if (oErr) throw oErr;

  const orderRows = (orders ?? []) as OrderRow[];

  const anomalies = {
    orders_missing_company_id: 0,
    orders_missing_location_id: 0,
    orders_missing_slot: 0,
    orders_missing_date: 0,
    profiles_missing: 0,
    day_choices_missing: 0,
  };
  const anomalyIds: string[] = [];

  for (const o of orderRows) {
    if (!o.company_id) {
      anomalies.orders_missing_company_id += 1;
      anomalyIds.push(String(o.id));
    }
    if (!o.location_id) {
      anomalies.orders_missing_location_id += 1;
      anomalyIds.push(String(o.id));
    }
    if (!o.slot) {
      anomalies.orders_missing_slot += 1;
      anomalyIds.push(String(o.id));
    }
    if (!o.date) {
      anomalies.orders_missing_date += 1;
      anomalyIds.push(String(o.id));
    }
  }

  if (orderRows.length === 0) {
    logOpsSummary({
      rid,
      date: dateISO,
      company_id: companyId,
      location_id: locationId ?? null,
      orders_total: 0,
      groups_total: 0,
      anomalies,
      anomaly_ids: uniq(anomalyIds).slice(0, 20),
    });
    return { groups: [] as KitchenGroup[] };
  }

  const companyIds = uniq(orderRows.map((o) => safeStr(o.company_id)).filter(Boolean));
  const locationIds = uniq(orderRows.map((o) => safeStr(o.location_id)).filter(Boolean));
  const userIds = uniq(orderRows.map((o) => safeStr(o.user_id)).filter(Boolean));

  // =========================================================
  // 2) Profiles / locations / companies
  // =========================================================
  const [profilesRes, locationsRes, companiesRes] = await Promise.all([
    userIds.length
      ? admin
          .from("profiles")
          .select("user_id, full_name, department, name, display_name, first_name, last_name, email, company_id")
          .in("user_id", userIds)
          .eq("company_id", companyId)
      : Promise.resolve({ data: [], error: null } as any),
    locationIds.length
      ? admin.from("company_locations").select("id, name").in("id", locationIds)
      : Promise.resolve({ data: [], error: null } as any),
    companyIds.length
      ? admin.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (locationsRes.error) throw locationsRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const profMap = new Map<string, { full_name: string; department: string | null }>();
  (profilesRes.data ?? []).forEach((p: any) => {
    profMap.set(String(p.user_id), {
      full_name: pickProfileName(p),
      department: (p?.department ?? null) as string | null,
    });
  });

  if (userIds.length) {
    const missingProfiles = userIds.filter((uid) => !profMap.has(uid));
    anomalies.profiles_missing = missingProfiles.length;
    anomalyIds.push(...missingProfiles.slice(0, 20));
  }

  const locMap = new Map<string, { name: string }>();
  (locationsRes.data ?? []).forEach((l: any) => {
    locMap.set(String(l.id), { name: pickLocationName(l) });
  });

  const compMap = new Map<string, { name: string }>();
  (companiesRes.data ?? []).forEach((c: any) => {
    compMap.set(String(c.id), { name: pickCompanyName(c) });
  });

  // =========================================================
  // 3) day_choices = hva de vil ha (choice + variant note)
  //    Merge in code (robust)
  // =========================================================
  const dcMap = new Map<string, DayChoiceRow>(); // ✅ prefer-const

  if (userIds.length) {
    const { data: dayChoices, error: dcErr } = await (admin as any)
      .from("day_choices")
      .select("company_id, location_id, user_id, date, choice_key, note, status, updated_at")
      .eq("company_id", companyId)
      .in("user_id", userIds)
      .eq("date", dateISO);

    if (dcErr) {
      // fail-soft: kitchen list still works, but notes might be legacy
      opsLog("kitchen.day.day_choices_failed", {
        rid,
        date: dateISO,
        company_id: companyId,
        detail: String(dcErr?.message ?? dcErr),
      });
    } else {
      for (const r of (dayChoices ?? []) as DayChoiceRow[]) {
        const key = `${safeStr(r.company_id)}|${safeStr(r.location_id)}|${safeStr(r.user_id)}|${safeStr(r.date)}`;
        const prev = dcMap.get(key);
        const prevT = prev?.updated_at ? new Date(prev.updated_at).getTime() : 0;
        const nextT = r?.updated_at ? new Date(r.updated_at).getTime() : 0;
        if (!prev || nextT >= prevT) dcMap.set(key, r);
      }
    }
  }

  // count missing day_choices for active orders (not fatal)
  for (const o of orderRows) {
    const k = `${safeStr(o.company_id)}|${safeStr(o.location_id)}|${safeStr(o.user_id)}|${safeStr(o.date)}`;
    if (!dcMap.has(k)) anomalies.day_choices_missing += 1;
  }

  const mealKeys = new Set<string>();
  for (const o of orderRows) {
    const dcKey = `${safeStr(o.company_id)}|${safeStr(o.location_id)}|${safeStr(o.user_id)}|${safeStr(o.date)}`;
    const dc = dcMap.get(dcKey);
    const choiceKey = dc?.choice_key ?? parseChoiceKeyFromLegacyNote(o.note ?? null);
    if (choiceKey) mealKeys.add(normalizeMealTypeKey(choiceKey));
  }
  let menuByMeal = new Map<string, CmsMenuByMealType>();
  try {
    menuByMeal = await getMenusByMealTypes([...mealKeys]);
  } catch (e: any) {
    opsLog("kitchen.day.cms_menu_failed", { rid, detail: String(e?.message ?? e) });
  }

  // =========================================================
  // 4) Kitchen batch status (optional)
  // =========================================================
  const windows = uniq(orderRows.map((o) => normSlot(o.slot)).filter(Boolean));
  const batchMap = new Map<string, any>();

  if (locationIds.length && windows.length) {
    const { data: batches, error: bErr } = await (admin as any)
      .from("kitchen_batch")
      .select("delivery_date, delivery_window, company_location_id, status, packed_at, delivered_at")
      .eq("delivery_date", dateISO)
      .in("company_location_id", locationIds)
      .in("delivery_window", windows);

    if (!bErr) {
      (batches ?? []).forEach((b: any) => {
        const key = `${b.delivery_date}|${safeStr(b.delivery_window).toLowerCase()}|${b.company_location_id}`;
        batchMap.set(key, b);
      });
    }
  }

  // =========================================================
  // 5) Group + build final orders list
  // =========================================================
  const groups = new Map<string, KitchenGroup>();

  for (const o of orderRows) {
    const window = normSlot(o.slot);
    const locId = safeStr(o.location_id);
    const compId = safeStr(o.company_id);
    if (!locId || !compId) continue;

    const groupKey = `${dateISO}|${window}|${compId}|${locId}`;
    if (!groups.has(groupKey)) {
      const loc = locMap.get(locId);
      const comp = compMap.get(compId);
      const bKey = `${dateISO}|${window}|${locId}`;
      const br = batchMap.get(bKey);

      groups.set(groupKey, {
        delivery_date: dateISO,
        delivery_window: window,
        company: comp?.name ?? "Ukjent firma",
        location: loc?.name ?? "Ukjent lokasjon",
        company_id: compId,
        location_id: locId,
        company_location_id: locId,
        batch_status: br ? batchStatusFromRow(br) : "queued",
        packed_at: br?.packed_at ?? null,
        delivered_at: br?.delivered_at ?? null,
        orders: [],
      });
    }

    const prof = profMap.get(String(o.user_id));

    // Prefer day_choices for kitchen note
    const dcKey = `${safeStr(o.company_id)}|${safeStr(o.location_id)}|${safeStr(o.user_id)}|${safeStr(o.date)}`;
    const dc = dcMap.get(dcKey);

    const choiceKey = dc?.choice_key ?? parseChoiceKeyFromLegacyNote(o.note ?? null);
    const nk = choiceKey ? normalizeMealTypeKey(choiceKey) : "";
    const menuRow = nk ? menuByMeal.get(nk) : null;
    const kitchenNote = buildKitchenNote(choiceKey, dc?.note ?? null, menuByMeal);

    groups.get(groupKey)!.orders.push({
      id: String(o.id),
      full_name: prof?.full_name ?? "Ukjent",
      department: prof?.department ?? null,
      note: kitchenNote ?? o.note ?? null,
      menu_title: menuRow?.title ?? null,
      menu_description: menuRow?.description ?? null,
      menu_allergens: Array.isArray(menuRow?.allergens) ? menuRow!.allergens! : [],
    });
  }

  const out = Array.from(groups.values()).sort((a, b) => {
    const w = a.delivery_window.localeCompare(b.delivery_window, "nb");
    if (w !== 0) return w;
    const c = a.company.localeCompare(b.company, "nb");
    if (c !== 0) return c;
    return a.location.localeCompare(b.location, "nb");
  });

  for (const g of out) {
    g.orders.sort((a, b) => a.full_name.localeCompare(b.full_name, "nb"));
  }

  logOpsSummary({
    rid,
    date: dateISO,
    company_id: companyId,
    location_id: locationId ?? null,
    orders_total: orderRows.length,
    groups_total: out.length,
    anomalies,
    anomaly_ids: uniq(anomalyIds).slice(0, 20),
  });

  return { groups: out };
}
