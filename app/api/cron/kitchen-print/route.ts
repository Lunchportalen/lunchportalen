// app/api/cron/kitchen-print/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

import { requireCronAuth as requireCronAuthShared } from "@/lib/http/cronAuth";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

import { cutoffStatusForDate0805, isIsoDate, osloNowISO, osloTodayISODate } from "@/lib/date/oslo";
import { opsLog } from "@/lib/ops/log";
import { buildBatchSummary } from "@/lib/kitchen/batchSummary";
import { fetchKitchenDayData } from "@/lib/kitchen/dayData";
import { cutoffAtUTCISO0805 } from "@/lib/kitchen/cutoff";

/* =========================================================
   Helpers
========================================================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function clampStr(v: unknown, max = 120) {
  const s = safeStr(v);
  return s.length ? s.slice(0, max) : "";
}

function requireCronAuth(req: NextRequest) {
  requireCronAuthShared(req);
  return { mode: "cron" as const, actor_id: null as string | null };
}
function cutoffAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_LOCKED") return { ok: true as const };
  if (status === "PAST") return { ok: true as const };
  if (status === "FUTURE_OPEN")
    return { ok: false as const, code: "DATE_IN_FUTURE", status: 409 as const, message: "Datoen er i fremtiden." };
  return { ok: false as const, code: "CUTOFF_NOT_REACHED", status: 425 as const, message: "Cut-off er ikke passert." };
}

type BatchSummarySlot = {
  slot: string;
  location_id: string;
  count: number;
  batch: { id: string | null; status: string; packed_at: string | null; delivered_at: string | null } | null;
};

/**
 * Auth model:
 * - Cron: Authorization Bearer or x-cron-secret
 * - Superadmin fallback: session scope + role
 *
 * NOTE: Query-string secrets are intentionally not supported.
 */
async function authOrCron(req: NextRequest, rid: string) {
  try {
    const cron = requireCronAuth(req);
    return { ok: true as const, actor_id: cron.actor_id, mode: cron.mode };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    // If CRON_SECRET missing -> hard fail for cron mode, but allow superadmin session fallback (useful in local).
    // In staging/prod, CRON_SECRET MUST be set anyway (CODEX STOP THE LINE).
    if (msg !== "cron_secret_missing" && code !== "cron_secret_missing" && msg !== "forbidden" && code !== "forbidden") {
      return { ok: false as const, res: jsonErr(rid, "Uventet feil i cron-gate.", 500, { code: "CRON_GATE_ERROR", detail: { message: msg } }) };
    }
  }

  // Session fallback (superadmin)
  const a = await scopeOr401(req);
  if (a.ok === false) return { ok: false as const, res: a.res };

  const denyRole = requireRoleOr403(a.ctx, "cron.kitchen.print", ["superadmin"]);
  if (denyRole) return { ok: false as const, res: denyRole };

  return { ok: true as const, actor_id: a.ctx.scope.userId ?? null, mode: "superadmin" as const };
}

/* =========================================================
   GET /api/cron/kitchen-print?date=YYYY-MM-DD&slot=...&location_id=...
========================================================= */
export async function GET(req: NextRequest) {
  const rid = makeRid();

  const auth = await authOrCron(req, rid);
  if (auth.ok === false) return auth.res;

  const admin = supabaseAdmin();
  const url = new URL(req.url);

  const dateParam = clampStr(url.searchParams.get("date"), 20);
  const slotParam = clampStr(url.searchParams.get("slot"), 40);
  const locationParam = clampStr(url.searchParams.get("location_id"), 80);

  const dateISO = dateParam && isIsoDate(dateParam) ? dateParam : osloTodayISODate();
  const slot = slotParam ? slotParam : "";
  const locationId = locationParam;

  if (!isIsoDate(dateISO)) {
    return jsonErr(rid, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateParam } });
  }
  if (!locationId) return jsonErr(rid, "location_id er påkrevd.", 400, "MISSING_LOCATION");
  if (!slot) return jsonErr(rid, "slot er påkrevd.", 400, "MISSING_SLOT");

  const cutoff = cutoffAllowed(dateISO);
  if (!cutoff.ok) return jsonErr(rid, cutoff.message, cutoff.status ?? 400, cutoff.code);

  const summary = await buildBatchSummary({ admin, dateISO, locationId, slot, rid });
  if (!summary.ok) {
    const err = summary as { status: number; code: string; message: string; detail?: any };
    return jsonErr(rid, err.message, err.status ?? 400, err.code);
  }

  const slotRow = (summary.data.slot_locations as BatchSummarySlot[]).find((s) => s.slot === slot) ?? null;
  if (!slotRow?.batch) {
    return jsonErr(rid, "Batch finnes ikke.", 404, {
      code: "NOT_FOUND",
      detail: { date: dateISO, location_id: locationId, slot },
    });
  }

  const batchStatus = safeStr(slotRow.batch.status).toUpperCase();
  if (batchStatus !== "PACKED" && batchStatus !== "DELIVERED") {
    return jsonErr(rid, "Batch er ikke klar for print.", 409, { code: "BATCH_NOT_READY", detail: { status: batchStatus || null } });
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
      rid,
      cutoffAtUTCISO: cutoffAt,
      afterCutoff: true,
    });
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke hente grunnlag for print.", 500, {
      code: "KITCHEN_DAYDATA_FAILED",
      detail: { message: String(e?.message ?? e ?? "unknown") },
    });
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
      .filter((l: any) => l.slot === slot)
      .map((l: any) => ({
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
    rid,
    date: dateISO,
    company_id: summary.data.company_id,
    location_id: summary.data.location_id,
    slot,
    orders: summary.data.counts.orders,
    payload_hash: payloadHash,
    actor_id: auth.actor_id,
    mode: auth.mode,
  });

  // jsonOk already sets no-store in your stack; still deterministic payload.
  // NOTE: If you want true ETag support, add header `etag: "<hash>"`.
  return jsonOk(
    rid,
    {
      ok: true,
      rid,
      status,
      generated_at: osloNowISO(),
      payload_hash: payloadHash,
      payload,
    },
    200
  );
}





