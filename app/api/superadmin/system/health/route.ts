// app/api/superadmin/system/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { validateSystemRuntimeEnv } from "@/lib/env/system";
import { runHealthChecks, type HealthStatus } from "@/lib/system/health";
import { deriveReasons, deriveSystemStatus } from "@/lib/system/healthStatus";
import { getClosedDatesForDate } from "@/lib/sanity/getClosedDatesForDate";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

type CheckStatus = "OK" | "WARN" | "FAIL";
type SystemStatus = "normal" | "degraded";

type HealthCheck = { key: string; status: CheckStatus; message: string };

type IncidentType = "AUTH" | "PROFILE" | "ORDER" | "SANITY" | "DB" | "OUTBOX" | "INTEGRATION";
type IncidentSeverity = "info" | "warn" | "crit";

type OpsEventInput = {
  level: "info" | "warn" | "error";
  event: string;
  scope_company_id?: string | null;
  scope_user_id?: string | null;
  data?: Record<string, any>;
  rid?: string | null;
};

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  // NOTE: MUST be valid UTF-8. Keep message plain.
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function nowIso() {
  return new Date().toISOString();
}

function mapStatus(status: HealthStatus): CheckStatus {
  if (status === "ok") return "OK";
  if (status === "fail") return "FAIL";
  return "WARN";
}

function severityFor(status: CheckStatus): IncidentSeverity {
  if (status === "FAIL") return "crit";
  if (status === "WARN") return "warn";
  return "info";
}

function typeForCheck(key: string): IncidentType {
  if (key.startsWith("db")) return "DB";
  if (key.startsWith("sanity")) return "SANITY";
  if (key.startsWith("runtime")) return "INTEGRATION";
  if (key.startsWith("time")) return "INTEGRATION";
  return "INTEGRATION";
}

async function writeOpsEvent(admin: any, input: OpsEventInput) {
  try {
    const { error } = await admin.from("ops_events").insert({
      level: input.level,
      event: input.event,
      scope_company_id: input.scope_company_id ?? null,
      scope_user_id: input.scope_user_id ?? null,
      data: input.data ?? {},
      rid: input.rid ?? null,
    });
    if (error) throw error;
  } catch (e: any) {
    opsLog("ops_events.insert_failed", {
      rid: input.rid ?? null,
      message: String(e?.message ?? e),
      event: input.event,
    });
  }
}

async function insertSnapshot(admin: any, rid: string, status: SystemStatus, checks: HealthCheck[], reasons: string[]) {
  try {
    const { error } = await admin.from("system_health_snapshots").insert({
      ts: nowIso(),
      status,
      checks: { items: checks, reasons },
      rid,
    });
    if (error) throw error;
  } catch (e: any) {
    opsLog("system_health_snapshots.insert_failed", { rid, message: String(e?.message ?? e) });
  }
}

async function findOpenIncident(admin: any, type: IncidentType, checkKey: string) {
  const res = await admin
    .from("system_incidents")
    .select("id,count,details,status")
    .eq("type", type)
    .eq("status", "open")
    .limit(50);

  if (res.error) throw res.error;
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.find((row: any) => row?.details?.check_key === checkKey) ?? null;
}

async function resolveIncident(admin: any, rid: string, type: IncidentType, checkKey: string, message: string) {
  try {
    const existing = await findOpenIncident(admin, type, checkKey);
    if (!existing) return;

    const now = nowIso();
    const details = {
      ...(existing.details ?? {}),
      resolved_at: now,
      last_message: message,
    };

    const { error } = await admin
      .from("system_incidents")
      .update({
        status: "resolved",
        last_seen: now,
        details,
        rid,
      })
      .eq("id", existing.id);

    if (error) throw error;

    await writeOpsEvent(admin, {
      level: "info",
      event: "system.incident.resolved",
      data: { type, check_key: checkKey },
      rid,
    });
  } catch (e: any) {
    opsLog("system_incident.resolve_failed", { rid, message: String(e?.message ?? e), type, checkKey });
  }
}

async function upsertIncident(admin: any, rid: string, check: HealthCheck) {
  const type = typeForCheck(check.key);

  if (check.status === "OK") {
    await resolveIncident(admin, rid, type, check.key, check.message);
    return;
  }

  try {
    const existing = await findOpenIncident(admin, type, check.key);
    const now = nowIso();
    const details = {
      ...(existing?.details ?? {}),
      check_key: check.key,
      last_status: check.status,
      last_message: check.message,
      last_seen: now,
    };

    if (existing) {
      const count = Number(existing.count ?? 0) + 1;
      const { error } = await admin
        .from("system_incidents")
        .update({
          severity: severityFor(check.status),
          last_seen: now,
          count,
          details,
          rid,
        })
        .eq("id", existing.id);

      if (error) throw error;

      await writeOpsEvent(admin, {
        level: "warn",
        event: "system.incident.update",
        data: { type, check_key: check.key, status: check.status },
        rid,
      });
      return;
    }

    const { error } = await admin.from("system_incidents").insert({
      severity: severityFor(check.status),
      type,
      scope_company_id: null,
      scope_user_id: null,
      scope_order_id: null,
      first_seen: now,
      last_seen: now,
      count: 1,
      status: "open",
      details,
      rid,
    });

    if (error) throw error;

    await writeOpsEvent(admin, {
      level: "warn",
      event: "system.incident.open",
      data: { type, check_key: check.key, status: check.status },
      rid,
    });
  } catch (e: any) {
    opsLog("system_incident.upsert_failed", { rid, message: String(e?.message ?? e), checkKey: check.key });
  }
}

function normalizeChecks(input: HealthCheck[], isProduction: boolean): HealthCheck[] {
  if (!input.length) return [];

  // Dev ergonomics: runtime FAIL can be WARN outside prod.
  return input.map((c) => {
    if (!isProduction && c.key === "runtime" && c.status === "FAIL") {
      return { ...c, status: "WARN" };
    }
    return c;
  });
}

function ensureCheck(checks: HealthCheck[], key: string, status: CheckStatus, message: string) {
  const existing = checks.find((c) => c.key === key);
  if (existing) {
    existing.status = status;
    existing.message = message;
    return;
  }
  checks.push({ key, status, message });
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.system.health.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const report = await runHealthChecks();

    const mappedChecks: HealthCheck[] = (Array.isArray((report as any).checks) ? (report as any).checks : []).map(
      (c: any) => ({
        key: String(c.key ?? "unknown"),
        status: mapStatus(c.status as HealthStatus),
        message: String(c.message ?? ""),
      })
    );

    const todayIso = String((report as any).todayOslo ?? "").trim();

    // 1) Runtime env check is authoritative for "runtime" key
    const runtimeEnv = validateSystemRuntimeEnv();

    // âœ… TS-safe: missing may only exist on one union branch
    const runtimeMissing =
      !runtimeEnv.ok && "missing" in runtimeEnv && Array.isArray((runtimeEnv as any).missing)
        ? ((runtimeEnv as any).missing as string[])
        : [];

    const runtimeDetails = {
      ok: runtimeEnv.ok,
      missing: runtimeMissing,
      node_env: process.env.NODE_ENV || "unknown",
      runtime: "nodejs",
    };

    ensureCheck(
      mappedChecks,
      "runtime",
      runtimeEnv.ok ? "OK" : "WARN",
      runtimeEnv.ok
        ? "Env / runtime config OK."
        : `Mangler env: ${runtimeMissing.length ? runtimeMissing.join(", ") : "ukjent"}`
    );

    // 2) Sanity helper check (non-fatal -> WARN)
    let sanityOk = false;
    try {
      const checkDate = todayIso || nowIso().slice(0, 10);
      await getClosedDatesForDate(checkDate);
      sanityOk = true;
    } catch {
      sanityOk = false;
    }

    ensureCheck(
      mappedChecks,
      "sanity",
      sanityOk ? "OK" : "WARN",
      sanityOk ? "Sanity helper OK (getClosedDatesForDate)." : "Sanity helper ikke funnet (getClosedDatesForDate)."
    );

    const isProduction = process.env.NODE_ENV === "production";
    const checks = normalizeChecks(mappedChecks, isProduction);

    // 3) Reasons + status MUST be derived from checks (single source of truth)
    const reasons = deriveReasons(checks);
    const status: SystemStatus = deriveSystemStatus(checks);

    const ts = String((report as any).timestamp ?? nowIso());

    const admin = supabaseAdmin();

    // 4) Persist snapshot + ops-event (best-effort, must not break response)
    await insertSnapshot(admin, ctx.rid, status, checks, reasons);
    await writeOpsEvent(admin, {
      level: status === "normal" ? "info" : "warn",
      event: "system.health.snapshot",
      data: { status, reasons_count: reasons.length, checks_count: checks.length },
      rid: ctx.rid,
    });

    // 5) Incidents per check (best-effort)
    for (const check of checks) {
      await upsertIncident(admin, ctx.rid, check);
    }

    return jsonOk(
      ctx.rid,
      {
        status,
        reasons,
        checks: { items: checks },
        details: { runtime: runtimeDetails },
        ts,
      },
      200
    );
  } catch (e: any) {
    opsLog("superadmin.system.health.error", { rid: (s?.ctx?.rid ?? null) as any, message: String(e?.message ?? e) });
    return jsonErr(ctx.rid, "Kunne ikke hente systemstatus.", 500, {
      code: "SYSTEM_HEALTH_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}

