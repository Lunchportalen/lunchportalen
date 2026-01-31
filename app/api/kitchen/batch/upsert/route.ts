// app/api/kitchen/batch/upsert/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isIsoDate } from "@/lib/date/oslo";
import { auditWriteMust } from "@/lib/audit/auditWrite";

/* ================= Helpers ================= */

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}
type BatchStatus = "QUEUED" | "PACKED" | "DELIVERED";
function normStatus(v: any): BatchStatus | null {
  const s = safeStr(v).toUpperCase();
  if (s === "QUEUED" || s === "PACKED" || s === "DELIVERED") return s;
  return null;
}
function nowIso() {
  return new Date().toISOString();
}
function batchKey(date: string, slot: string, location_id: string) {
  return `${date}__${slot}__${location_id}`;
}

/* ================= POST ================= */

export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res; // ✅ TS-narrowing fix

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.upsert", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  // belt & suspenders: bekreft cookie-session
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) {
    return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");
  }

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Service role mangler.", { detail: safeStr(e?.message ?? e) });
  }

  try {
    const body = await readJson(req);

    const date = safeStr(body?.date);
    const slot = normSlot(body?.slot);
    const location_id = safeStr(body?.location_id);
    const status = normStatus(body?.status);

    if (!isIsoDate(date)) return jsonErr(400, rid, "INVALID_DATE", "Ugyldig dato.", { date });
    if (!location_id) return jsonErr(400, rid, "MISSING_LOCATION", "Mangler location_id.");
    if (!status) return jsonErr(400, rid, "INVALID_STATUS", "Ugyldig status.", { status: body?.status });

    const ts = nowIso();

    const payload = {
      delivery_date: date,
      delivery_window: slot,
      company_location_id: location_id,
      status,
      packed_at: status === "PACKED" || status === "DELIVERED" ? ts : null,
      delivered_at: status === "DELIVERED" ? ts : null,
    };

    const { data: saved, error } = await admin
      .from("kitchen_batch") // ✅ entall
      .upsert(payload, { onConflict: "delivery_date,delivery_window,company_location_id" })
      .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at")
      .maybeSingle();

    if (error || !saved) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke lagre batch.", { message: error?.message ?? null });
    }

    // MUST audit (fail-closed)
    await auditWriteMust({
      rid,
      action: "KITCHEN_BATCH_UPSERT",
      entity_type: "kitchen_batch",
      entity_id: batchKey(date, slot, location_id),
      company_id: null,
      location_id,
      actor_user_id: safeStr(scope.userId) || auth.user.id,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      summary: `Batch ${status}`,
      detail: payload,
    });

    return jsonOk({
      ok: true,
      rid,
      batch: {
        delivery_date: saved.delivery_date,
        delivery_window: saved.delivery_window,
        company_location_id: saved.company_location_id,
        status: saved.status,
        packed_at: saved.packed_at ?? null,
        delivered_at: saved.delivered_at ?? null,
      },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? e));
  }
}


