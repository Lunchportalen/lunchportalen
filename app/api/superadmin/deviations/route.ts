export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function osloHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Oslo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
}

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const deny = requireRoleOr403(gate.ctx, "superadmin.deviations.read", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  const date = osloTodayISODate();
  const hour = osloHour();
  const admin = supabaseAdmin();

  try {
    const [ordersRes, batchesRes] = await Promise.all([
      admin.from("orders").select("id, location_id").eq("date", date).eq("status", "ACTIVE"),
      admin
        .from("kitchen_batches")
        .select("company_location_id, status")
        .eq("delivery_date", date)
        .in("status", ["PACKED", "DELIVERED"]),
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (batchesRes.error) throw batchesRes.error;

    const packed = new Set((batchesRes.data ?? []).map((batch: any) => safeStr(batch.company_location_id)).filter(Boolean));
    const unpacked = hour >= 10 ? (ordersRes.data ?? []).filter((order: any) => !packed.has(safeStr(order.location_id))).length : 0;
    const undelivered =
      hour >= 14 ? (batchesRes.data ?? []).filter((batch: any) => safeStr(batch.status).toUpperCase() === "PACKED").length : 0;

    return jsonOk(rid, { date, hour, unpacked, undelivered }, 200);
  } catch (error: any) {
    return jsonErr(rid, "Kunne ikke hente avvik.", 500, "DEVIATIONS_FETCH_FAILED", {
      message: safeStr(error?.message ?? error),
    });
  }
}
