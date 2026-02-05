// lib/kitchen/dayData.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { opsLog } from "@/lib/ops/log";

export type KitchenOrder = {
  id: string;
  full_name: string;
  department: string | null;
  note: string | null;
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
  status: string | null;
  slot: string | null;
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
  const full = pickString(p?.full_name, p?.name, p?.display_name, p?.displayName, p?.fullName);
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

  let q = admin
    .from("orders")
    .select("id, user_id, company_id, location_id, date, note, created_at, status, slot")
    .eq("date", dateISO)
    .in("status", ["ACTIVE", "active", "QUEUED", "PACKED", "DELIVERED"])
    .eq("integrity_status", "ok")
    .eq("company_id", companyId);

  if (locationId) q = q.eq("location_id", locationId);
  if (slot) q = q.eq("slot", slot);
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
    employees_missing_company_id: 0,
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

  const profMap = new Map<string, { full_name: string; department: string | null; company_id: string | null }>();
  (profilesRes.data ?? []).forEach((p: any) => {
    profMap.set(String(p.user_id), {
      full_name: pickProfileName(p),
      department: (p?.department ?? null) as string | null,
      company_id: (p?.company_id ?? null) as string | null,
    });
  });

  if (userIds.length) {
    const missingProfiles = userIds.filter((uid) => !profMap.has(uid));
    anomalies.employees_missing_company_id = missingProfiles.length;
    anomalyIds.push(...missingProfiles);
  }

  const locMap = new Map<string, { name: string }>();
  (locationsRes.data ?? []).forEach((l: any) => {
    locMap.set(String(l.id), { name: pickLocationName(l) });
  });

  const compMap = new Map<string, { name: string }>();
  (companiesRes.data ?? []).forEach((c: any) => {
    compMap.set(String(c.id), { name: pickCompanyName(c) });
  });

  const windows = uniq(orderRows.map((o) => normSlot(o.slot)).filter(Boolean));
  const batchMap = new Map<string, any>();

  if (locationIds.length && windows.length) {
    const { data: batches } = await admin
      .from("kitchen_batch")
      .select("delivery_date, delivery_window, company_location_id, status, packed_at, delivered_at")
      .eq("delivery_date", dateISO)
      .in("company_location_id", locationIds)
      .in("delivery_window", windows);

    (batches ?? []).forEach((b: any) => {
      const key = `${b.delivery_date}|${safeStr(b.delivery_window).toLowerCase()}|${b.company_location_id}`;
      batchMap.set(key, b);
    });
  }

  const groups = new Map<string, KitchenGroup>();

  for (const o of orderRows) {
    const window = normSlot(o.slot);
    const locId = safeStr(o.location_id);
    const compId = safeStr(o.company_id);
    if (!locId || !compId) continue;

    const key = `${dateISO}|${window}|${compId}|${locId}`;
    if (!groups.has(key)) {
      const loc = locMap.get(locId);
      const comp = compMap.get(compId);
      const bKey = `${dateISO}|${window}|${locId}`;
      const br = batchMap.get(bKey);

      groups.set(key, {
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
    groups.get(key)!.orders.push({
      id: String(o.id),
      full_name: prof?.full_name ?? "Ukjent",
      department: prof?.department ?? null,
      note: o.note ?? null,
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

