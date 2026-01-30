// app/api/kitchen/batch/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

type BatchRow = {
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: string;
  packed_at: string | null;
  delivered_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.list", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  // confirm cookie-session
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");

  let admin: ReturnType<typeof supabaseAdmin>;
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

    const slotQ = safeStr(url.searchParams.get("slot"));
    const slot = slotQ ? normSlot(slotQ) : null;

    const locationQ = safeStr(url.searchParams.get("location_id"));
    const location_id = locationQ || null;

    let q = admin
      .from("kitchen_batch")
      .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at,created_at,updated_at")
      .eq("delivery_date", date);

    if (slot) q = q.eq("delivery_window", slot);
    if (location_id) q = q.eq("company_location_id", location_id);

    const { data, error } = await q;

    if (error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente batch-liste.", {
        message: error.message,
        code: (error as any).code ?? null,
      });
    }

    const rows = ((data ?? []) as BatchRow[]).map((r) => ({
      delivery_date: r.delivery_date,
      delivery_window: normSlot(r.delivery_window),
      company_location_id: r.company_location_id,
      status: safeStr(r.status).toUpperCase(),
      packed_at: r.packed_at ?? null,
      delivered_at: r.delivered_at ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    }));

    // deterministisk sortering
    rows.sort((a, b) => {
      const A = `${a.delivery_window}|${a.company_location_id}`;
      const B = `${b.delivery_window}|${b.company_location_id}`;
      return A.localeCompare(B, "nb");
    });

    return jsonOk({ ok: true, rid, date, count: rows.length, rows });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? e), { at: "kitchen/batch/list" });
  }
}
