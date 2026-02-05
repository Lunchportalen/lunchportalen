export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du m� v�re innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingRelation(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.system.orders.integrity.summary.GET", ["superadmin"]);
  if (deny) return deny;

  const admin = supabaseAdmin();
  const fromDate = daysAgoISO(29);
  const counts = { ok: 0, quarantined: 0 };

  try {
    const okRes = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("integrity_status", "ok")
      .gte("date", fromDate);

    if (okRes.error) throw okRes.error;
    counts.ok = Number(okRes.count ?? 0);

    const qRes = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("integrity_status", "quarantined")
      .gte("date", fromDate);

    if (qRes.error) throw qRes.error;
    counts.quarantined = Number(qRes.count ?? 0);
  } catch (e: any) {
    if (!isMissingRelation(e) && !isMissingColumn(e)) {
      opsLog("order.integrity.summary.failed", { rid: ctx.rid, message: String(e?.message ?? e) });
    }
    return jsonOk(ctx.rid, { window_days: 30, counts, incidents: { items: [], total: 0 }, last_run: null }, 200);
  }

  let incidents: any[] = [];
  try {
    const res = await admin
      .from("system_incidents")
      .select("id,severity,type,status,count,first_seen,last_seen,details,rid")
      .like("type", "ORDER_%")
      .order("last_seen", { ascending: false })
      .limit(10);

    if (res.error) throw res.error;
    incidents = Array.isArray(res.data) ? res.data : [];
  } catch (e: any) {
    if (!isMissingRelation(e) && !isMissingColumn(e)) {
      opsLog("order.integrity.summary.incidents_failed", { rid: ctx.rid, message: String(e?.message ?? e) });
    }
    incidents = [];
  }

  let lastRun: any = null;
  try {
    const res = await admin
      .from("ops_events")
      .select("ts,data,rid")
      .eq("event", "order.integrity.run")
      .order("ts", { ascending: false })
      .limit(1);

    if (res.error) throw res.error;
    const row = Array.isArray(res.data) ? res.data[0] : null;
    if (row) {
      lastRun = {
        ts: row.ts ?? null,
        rid: row.rid ?? null,
        queued: Number(row?.data?.queued ?? 0),
        dedupe_groups: Number(row?.data?.dedupe_groups ?? 0),
        normalize_ids: Number(row?.data?.normalize_ids ?? 0),
        quarantine_ids: Number(row?.data?.quarantine_ids ?? 0),
      };
    }
  } catch (e: any) {
    if (!isMissingRelation(e) && !isMissingColumn(e)) {
      opsLog("order.integrity.summary.ops_failed", { rid: ctx.rid, message: String(e?.message ?? e) });
    }
  }

  return jsonOk(ctx.rid, { window_days: 30, counts, incidents: { items: incidents, total: incidents.length }, last_run: lastRun }, 200);
}
