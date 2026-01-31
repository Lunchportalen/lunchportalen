// app/api/kitchen/batch/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// Dag-3 helpers
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

type AllowedRole = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type BatchStatus = "queued" | "packed" | "delivered";

const allowedRoles = ["kitchen", "superadmin", "company_admin"] as const satisfies readonly AllowedRole[];
const allowedStatus = new Set<BatchStatus>(["queued", "packed", "delivered"]);

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

/**
 * PATCH /api/kitchen/batch
 * Body:
 * - delivery_date (YYYY-MM-DD)
 * - delivery_window (string)
 * - company_location_id (uuid/string)
 * - status: queued|packed|delivered
 *
 * Upsert på (delivery_date, delivery_window, company_location_id)
 * Table: delivery_batches
 */
export async function PATCH(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 1) Auth gate (401) — scopeOr401: Response | { ok:true, ctx }
  const scoped = await scopeOr401(req);
  if (scoped instanceof Response) return scoped;
  const ctx = scoped.ctx;

  // 2) Role gate (403) — requireRoleOr403: Response | void/null
  const denied = requireRoleOr403(ctx, allowedRoles);
  if (denied instanceof Response) return denied;

  // 3) Safe JSON (aldri throw)
  const body = await readJson(req);

  const delivery_date = safeStr(body?.delivery_date);
  const delivery_window = safeStr(body?.delivery_window);
  const company_location_id = safeStr(body?.company_location_id);
  const status = safeStr(body?.status) as BatchStatus;

  if (!delivery_date || !delivery_window || !company_location_id || !status) {
    return jsonErr(ctx, "BAD_REQUEST", "Missing fields.", {
      required: ["delivery_date", "delivery_window", "company_location_id", "status"],
    });
  }

  if (!isIsoDate(delivery_date)) {
    return jsonErr(ctx, "BAD_REQUEST", "Invalid delivery_date (expected YYYY-MM-DD).", {
      delivery_date,
    });
  }

  if (!allowedStatus.has(status)) {
    return jsonErr(ctx, "BAD_REQUEST", "Invalid status.", {
      status,
      allowed: Array.from(allowedStatus),
    });
  }

  // 4) Timestamps
  const now = new Date().toISOString();
  const patch: {
    status: BatchStatus;
    updated_at: string;
    packed_at?: string | null;
    delivered_at?: string | null;
  } = { status, updated_at: now };

  if (status === "queued") {
    patch.packed_at = null;
    patch.delivered_at = null;
  } else if (status === "packed") {
    patch.packed_at = now;
    patch.delivered_at = null;
  } else {
    patch.delivered_at = now;
  }

  // 5) Upsert (service role)
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("delivery_batches")
    .upsert(
      {
        delivery_date,
        delivery_window,
        company_location_id,
        ...patch,
      },
      { onConflict: "delivery_date,delivery_window,company_location_id" }
    );

  if (error) {
    return jsonErr(ctx, "DB_ERROR", "Could not update batch.", {
      code: error.code,
      msg: error.message,
    });
  }

  return jsonOk(ctx, {
    ok: true,
    delivery_date,
    delivery_window,
    company_location_id,
    status,
    updated_at: patch.updated_at,
    packed_at: patch.packed_at ?? null,
    delivered_at: patch.delivered_at ?? null,
  });
}


