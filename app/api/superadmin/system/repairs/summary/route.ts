export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

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

export async function GET(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.system.repairs.summary.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const admin = supabaseAdmin();
    const counts = { pending: 0, running: 0, failed: 0, done: 0 };

    const states = ["pending", "running", "failed", "done"] as const;
    for (const state of states) {
      const { count, error } = await admin
        .from("repair_jobs")
        .select("id", { count: "exact", head: true })
        .eq("state", state);

      if (error) {
        if (isMissingRelation(error) || isMissingColumn(error)) {
          return jsonOk(ctx.rid, { counts, last_run: null }, 200);
        }
        opsLog("repair.summary.count_failed", { rid: ctx.rid, message: String(error.message ?? error) });
        return jsonOk(ctx.rid, { counts, last_run: null }, 200);
      }

      counts[state] = Number(count ?? 0);
    }

    let lastRun: any = null;
    const { data, error } = await admin
      .from("ops_events")
      .select("ts,data,rid")
      .eq("event", "system.motor.run")
      .order("ts", { ascending: false })
      .limit(1);

    if (error) {
      if (!isMissingRelation(error) && !isMissingColumn(error)) {
        opsLog("repair.summary.ops_failed", { rid: ctx.rid, message: String(error.message ?? error) });
      }
    } else {
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        lastRun = {
          ts: row.ts ?? null,
          rid: row.rid ?? null,
          queued: Number(row?.data?.queued ?? 0),
          done: Number(row?.data?.done ?? 0),
          failed: Number(row?.data?.failed ?? 0),
          source: safeStr(row?.data?.source ?? "") || null,
        };
      }
    }

    return jsonOk(ctx.rid, { counts, last_run: lastRun }, 200);
  } catch (e: any) {
    return jsonOk(ctx.rid, { counts: { pending: 0, running: 0, failed: 0, done: 0 }, last_run: null }, 200);
  }
}
