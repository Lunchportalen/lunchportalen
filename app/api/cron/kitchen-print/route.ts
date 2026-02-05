// app/api/cron/kitchen-print/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { cutoffStatusForDate0805, isIsoDate, osloNowISO, osloTodayISODate } from "@/lib/date/oslo";
import { opsLog } from "@/lib/ops/log";
import { buildBatchSummary } from "@/lib/kitchen/batchSummary";
import { fetchKitchenDayData } from "@/lib/kitchen/dayData";
import { cutoffAtUTCISO0805 } from "@/lib/kitchen/cutoff";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function rid() {
  return `cron_kitchen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cutoffAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_LOCKED") return { ok: true as const };
  if (status === "PAST") return { ok: true as const };
  if (status === "FUTURE_OPEN") return { ok: false as const, code: "DATE_IN_FUTURE", status: 409 as const, message: "Datoen er i fremtiden." };
  return { ok: false as const, code: "CUTOFF_NOT_REACHED", status: 425 as const, message: "Cut-off er ikke passert." };
}

type BatchSummarySlot = {
  slot: string;
  location_id: string;
  count: number;
  batch: { id: string | null; status: string; packed_at: string | null; delivered_at: string | null } | null;
};

async function authOrCron(req: NextRequest) {
  const cronSecret = safeStr(process.env.CRON_SECRET);
  const headerSecret = safeStr(req.headers.get("x-cron-secret"));
  const url = new URL(req.url);
  const querySecret = safeStr(url.searchParams.get("key"));

  if (cronSecret && ((headerSecret && headerSecret === cronSecret) || (querySecret && querySecret === cronSecret))) {
    return { ok: true as const, actor_id: null as string | null, mode: "cron" as const };
  }

  const a = await scopeOr401(req);
  if (a.ok === false) return { ok: false as const, res: a.res };

  const denyRole = requireRoleOr403(a.ctx, "cron.kitchen.print", ["superadmin"]);
  if (denyRole) return { ok: false as const, res: denyRole };

  return { ok: true as const, actor_id: a.ctx.scope.userId ?? null, mode: "superadmin" as const };
}

export async function GET(req: NextRequest) {
  const r = rid();

  const auth = await authOrCron(req);
  if (auth.ok === false) return auth.res;

  const admin = supabaseAdmin();
  const url = new URL(req.url);
  const dateParam = safeStr(url.searchParams.get("date"));
  const slotParam = safeStr(url.searchParams.get("slot"));
  const locationParam = safeStr(url.searchParams.get("location_id"));

  const dateISO = dateParam && isIsoDate(dateParam) ? dateParam : osloTodayISODate();
  const slot = slotParam ? slotParam : "";
  const locationId = locationParam;

  if (!isIsoDate(dateISO)) return jsonErr(r, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateParam } });
  if (!locationId) return jsonErr(r, "location_id er påkrevd.", 400, "MISSING_LOCATION");
  if (!slot) return jsonErr(r, "slot er påkrevd.", 400, "MISSING_SLOT");

  const cutoff = cutoffAllowed(dateISO);
  if (!cutoff.ok) {
    return jsonErr(r, cutoff.message, cutoff.status ?? 400, cutoff.code);
  }

  const summary = await buildBatchSummary({ admin, dateISO, locationId, slot, rid: r });
  if (!summary.ok) {
    const err = summary as { status: number; code: string; message: string; detail?: any };
    return jsonErr(r, err.message, err.status ?? 400, err.code);
  }

  const slotRow = (summary.data.slot_locations as BatchSummarySlot[]).find((s) => s.slot === slot) ?? null;
  if (!slotRow?.batch) {
    return jsonErr(r, "Batch finnes ikke.", 404, { code: "NOT_FOUND", detail: { date: dateISO, location_id: locationId, slot } });
  }

  const batchStatus = safeStr(slotRow.batch.status).toUpperCase();
  if (batchStatus !== "PACKED" && batchStatus !== "DELIVERED") {
    return jsonErr(r, "Batch er ikke klar for print.", 409, { code: "BATCH_NOT_READY", detail: { status: batchStatus || null } });
  }

  let dayData: { groups: any[] };
  try {
    const cutoffAt = cutoffAtUTCISO0805(dateISO);
    dayData = await fetchKitchenDayData({
      admin: admin as any,
      dateISO,
      companyId: summary.data.company_id,
      locationId,
      slot,
      rid: r,
      cutoffAtUTCISO: cutoffAt,
      afterCutoff: true,
    });
  } catch (e: any) {
    return jsonErr(r, "Kunne ikke hente grunnlag for print.", 500, { code: "KITCHEN_DAYDATA_FAILED", detail: {
      message: String(e?.message ?? e ?? "unknown"),
    } });
  }

  const payload = {
    date: summary.data.date,
    company_id: summary.data.company_id,
    location_id: summary.data.location_id,
    slot,
    batch: {
      id: slotRow.batch.id ?? null,
      status: batchStatus,
      packed_at: slotRow.batch.packed_at ?? null,
      delivered_at: slotRow.batch.delivered_at ?? null,
    },
    counts: summary.data.counts,
    lines: summary.data.slot_locations
      .filter((l) => l.slot === slot)
      .map((l) => ({
        company_id: summary.data.company_id,
        location_id: summary.data.location_id,
        slot: l.slot,
        orders: l.count,
      })),
    groups: dayData.groups,
  };

  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
  const ifNoneMatch = safeStr(req.headers.get("if-none-match"));
  const status = ifNoneMatch && ifNoneMatch === payloadHash ? "already_generated" : "generated";

  opsLog("cron.kitchen.print", {
    rid: r,
    date: dateISO,
    company_id: summary.data.company_id,
    location_id: summary.data.location_id,
    slot,
    orders: summary.data.counts.orders,
    payload_hash: payloadHash,
    actor_id: auth.actor_id,
    mode: auth.mode,
  });

  return jsonOk(r, {
      status,
      generated_at: osloNowISO(),
      payload_hash: payloadHash,
      payload,
    }, 200);
}


