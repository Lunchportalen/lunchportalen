// app/api/kitchen/batch/summary/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

/**
 * Gir kjøkkenet et "dashboard"-kutt per dato:
 * - total orders (ACTIVE)
 * - per slot: count
 * - per lokasjon: count
 * - batch status per (slot+lokasjon) hvis finnes
 *
 * NB: Ingen audit her (read-only).
 */

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

type OrderLite = { slot: string | null; location_id: string; company_id: string };
type BatchLite = {
  delivery_window: string;
  company_location_id: string;
  status: string;
  packed_at: string | null;
  delivered_at: string | null;
};

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.summary", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  // confirm cookie-session
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Service role mangler.", { detail: safeStr(e?.message ?? e) });
  }

  try {
    const url = new URL(req.url);
    const dateQ = safeStr(url.searchParams.get("date")) || osloTodayISODate();
    const date = isIsoDate(dateQ) ? dateQ : "";
    if (!date) return jsonErr(400, rid, "INVALID_DATE", "Ugyldig dato.", { date: dateQ });

    // 1) hent ACTIVE orders (minimalt feltsett)
    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select("slot, location_id, company_id")
      .eq("date", date)
      .in("status", ["ACTIVE", "active"]);

    if (oErr) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre.", { message: oErr.message, code: (oErr as any).code ?? null });
    }

    const ord = (orders ?? []) as OrderLite[];

    // 2) hent batch rows for samme dato (entall: kitchen_batch)
    const { data: batches, error: bErr } = await admin
      .from("kitchen_batch")
      .select("delivery_window, company_location_id, status, packed_at, delivered_at")
      .eq("delivery_date", date);

    if (bErr) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente batch.", { message: bErr.message, code: (bErr as any).code ?? null });
    }

    const bat = (batches ?? []) as BatchLite[];
    const batchMap = new Map<string, BatchLite>();
    for (const b of bat) {
      const k = `${normSlot(b.delivery_window)}__${b.company_location_id}`;
      batchMap.set(k, b);
    }

    // 3) aggregér
    const total = ord.length;

    const bySlot = new Map<string, number>();
    const byLocation = new Map<string, number>();
    const bySlotLocation = new Map<string, number>();

    for (const o of ord) {
      const slot = normSlot(o.slot);
      const loc = safeStr(o.location_id);

      bySlot.set(slot, (bySlot.get(slot) ?? 0) + 1);
      byLocation.set(loc, (byLocation.get(loc) ?? 0) + 1);
      bySlotLocation.set(`${slot}__${loc}`, (bySlotLocation.get(`${slot}__${loc}`) ?? 0) + 1);
    }

    const slots = Array.from(bySlot.entries())
      .map(([slot, count]) => ({ slot, count }))
      .sort((a, b) => a.slot.localeCompare(b.slot, "nb"));

    const locations = Array.from(byLocation.entries())
      .map(([location_id, count]) => ({ location_id, count }))
      .sort((a, b) => a.location_id.localeCompare(b.location_id, "nb"));

    const slotLocations = Array.from(bySlotLocation.entries())
      .map(([k, count]) => {
        const [slot, location_id] = k.split("__");
        const b = batchMap.get(k);
        return {
          slot,
          location_id,
          count,
          batch: b
            ? {
                status: safeStr(b.status).toUpperCase(),
                packed_at: b.packed_at ?? null,
                delivered_at: b.delivered_at ?? null,
              }
            : null,
        };
      })
      .sort((a, b) => `${a.slot}|${a.location_id}`.localeCompare(`${b.slot}|${b.location_id}`, "nb"));

    return jsonOk({
      ok: true,
      rid,
      date,
      total_orders: total,
      slots,
      locations,
      slot_locations: slotLocations,
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? e), { at: "kitchen/batch/summary" });
  }
}


