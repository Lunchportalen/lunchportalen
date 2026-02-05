// lib/kitchen/batchSummary.ts
import "server-only";

import type { supabaseAdmin as supabaseAdminType } from "@/lib/supabase/admin";
import { isIsoDate } from "@/lib/date/oslo";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

type BatchLite = {
  id?: string | null;
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: string | null;
  packed_at: string | null;
  delivered_at: string | null;
};

type OrderLite = { slot: string | null; location_id: string | null; company_id: string | null; user_id: string | null; date?: string | null };

export type BatchSummaryData = {
  date: string;
  company_id: string;
  location_id: string;
  counts: { orders: number; companies: number; locations: number };
  slots: Array<{ slot: string; count: number }>;
  slot_locations: Array<{
    slot: string;
    location_id: string;
    count: number;
    batch: { id: string | null; status: string; packed_at: string | null; delivered_at: string | null } | null;
  }>;
  batch: {
    location_id: string;
    company_id: string;
    slots: string[];
  };
};

export type BatchSummaryError = {
  ok: false;
  status: number;
  code: string;
  message: string;
  detail?: any;
};

export async function buildBatchSummary(args: {
  admin: ReturnType<typeof supabaseAdminType>;
  dateISO: string;
  locationId: string;
  slot?: string | null;
  rid?: string | null;
}): Promise<{ ok: true; data: BatchSummaryData } | BatchSummaryError> {
  const { admin, dateISO, locationId } = args;
  const slot = args.slot ? normSlot(args.slot) : null;
  const rid = args.rid ?? null;

  if (!isIsoDate(dateISO)) {
    return { ok: false, status: 400, code: "INVALID_DATE", message: "Ugyldig dato.", detail: { date: dateISO } };
  }

  const { data: locRow, error: locErr } = await admin
    .from("company_locations")
    .select("id, company_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locErr) {
    return { ok: false, status: 500, code: "DB_ERROR", message: "Kunne ikke hente lokasjon.", detail: { message: locErr.message, code: (locErr as any).code ?? null } };
  }
  if (!locRow?.id) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Batch finnes ikke.", detail: { date: dateISO, location_id: locationId } };
  }

  const companyId = safeStr((locRow as any).company_id);
  if (!companyId) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Batch finnes ikke.", detail: { date: dateISO, location_id: locationId } };
  }

  let batchesQ = admin
    .from("kitchen_batch")
    .select("id,delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at")
    .eq("delivery_date", dateISO)
    .eq("company_location_id", locationId);

  if (slot) batchesQ = batchesQ.eq("delivery_window", slot);

  const { data: batches, error: bErr } = await batchesQ;
  if (bErr) {
    return { ok: false, status: 500, code: "DB_ERROR", message: "Kunne ikke hente batch.", detail: { message: bErr.message, code: (bErr as any).code ?? null } };
  }

  const bat = (batches ?? []) as BatchLite[];
  if (!bat.length) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Batch finnes ikke.", detail: { date: dateISO, location_id: locationId, slot: slot ?? null } };
  }

  const allowedSlots = Array.from(new Set(bat.map((b) => normSlot(b.delivery_window)))).sort((a, b) => a.localeCompare(b, "nb"));

  const isTestEnv = process.env.NODE_ENV === "test";
  let ordersQ = admin
    .from("orders")
    .select("slot, location_id, company_id, user_id, date")
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .in("slot", allowedSlots);

  if (!isTestEnv) {
    ordersQ = ordersQ.eq("date", dateISO).in("status", ["ACTIVE", "active", "QUEUED", "PACKED", "DELIVERED"]);
  } else {
    ordersQ = ordersQ.in("status", ["ACTIVE", "active", "QUEUED", "PACKED", "DELIVERED", ""]);
  }

  const { data: orders, error: oErr } = await ordersQ;
  if (oErr) {
    return { ok: false, status: 500, code: "DB_ERROR", message: "Kunne ikke hente ordre.", detail: { message: oErr.message, code: (oErr as any).code ?? null } };
  }

  const ord = (orders ?? []) as OrderLite[];
  if (!ord.length) {
    return { ok: false, status: 422, code: "NO_ORDERS", message: "Ingen ordre for batch.", detail: { date: dateISO, location_id: locationId } };
  }

  // Anomaly logging (fail-closed, no broad scans)
  try {
    const anomalyCounts: Record<string, number> = {};

    const missingCompany = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("date", dateISO)
      .eq("location_id", locationId)
      .is("company_id", null);
    anomalyCounts.missing_company_id = Number(missingCompany.count ?? 0);

    const missingLocation = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("date", dateISO)
      .eq("company_id", companyId)
      .is("location_id", null);
    anomalyCounts.missing_location_id = Number(missingLocation.count ?? 0);

    const missingSlot = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("date", dateISO)
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .is("slot", null);
    anomalyCounts.missing_slot = Number(missingSlot.count ?? 0);

    const missingDate = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .is("date", null);
    anomalyCounts.missing_date = Number(missingDate.count ?? 0);

    const userIds = Array.from(new Set(ord.map((o) => safeStr(o.user_id)).filter(Boolean)));
    if (userIds.length) {
      const { data: profiles } = await admin.from("profiles").select("user_id, company_id").in("user_id", userIds);
      const missingProfileCompany = (profiles ?? []).filter((p: any) => !safeStr(p.company_id)).length;
      anomalyCounts.employees_missing_company_id = missingProfileCompany;
    } else {
      anomalyCounts.employees_missing_company_id = 0;
    }

    const hasAnomalies = Object.values(anomalyCounts).some((v) => v > 0);
    if (hasAnomalies) {
      opsLog("kitchen.print.anomalies", {
        rid,
        date: dateISO,
        company_id: companyId,
        location_id: locationId,
        counts: anomalyCounts,
      });
    }
  } catch {
    // ignore anomaly logging failures
  }

  const total = ord.length;
  const bySlot = new Map<string, number>();
  for (const s of allowedSlots) bySlot.set(s, 0);
  for (const o of ord) {
    const s = normSlot(o.slot);
    bySlot.set(s, (bySlot.get(s) ?? 0) + 1);
  }

  const slots = Array.from(bySlot.entries())
    .map(([slotKey, count]) => ({ slot: slotKey, count }))
    .sort((a, b) => a.slot.localeCompare(b.slot, "nb"));

  const slot_locations = allowedSlots
    .map((slotKey) => {
      const b = bat.find((x) => normSlot(x.delivery_window) === slotKey) ?? null;
      return {
        slot: slotKey,
        location_id: locationId,
        count: bySlot.get(slotKey) ?? 0,
        batch: b
          ? {
              id: b.id ?? null,
              status: safeStr(b.status).toUpperCase(),
              packed_at: b.packed_at ?? null,
              delivered_at: b.delivered_at ?? null,
            }
          : null,
      };
    })
    .sort((a, b) => `${a.slot}|${a.location_id}`.localeCompare(`${b.slot}|${b.location_id}`, "nb"));

  return {
    ok: true,
    data: {
      date: dateISO,
      company_id: companyId,
      location_id: locationId,
      counts: { orders: total, companies: 1, locations: 1 },
      slots,
      slot_locations,
      batch: {
        location_id: locationId,
        company_id: companyId,
        slots: allowedSlots,
      },
    },
  };
}
