/**
 * Unified system health aggregator.
 * Combines database, cron, outbox, AI jobs, migrations, and environment checks.
 * Returns a single status and short, non-sensitive messages per component.
 */
import "server-only";

import { validateSystemRuntimeEnv } from "@/lib/env/system";

export type SystemHealthStatus = "ok" | "degraded" | "critical";

export type SystemHealthResult = {
  status: SystemHealthStatus;
  database: string;
  cron: string;
  outbox: string;
  ai_jobs: string;
  migrations: string;
  timestamp: string;
};

type AdminClient = {
  from: (table: string) => {
    select: (cols: string, opts?: { count: "exact"; head?: boolean }) => any;
    eq: (col: string, val: string) => any;
    gte: (col: string, val: string) => any;
    in: (col: string, vals: string[]) => any;
  };
};

const OUTBOX_PENDING_WARN = 500;
const OUTBOX_PENDING_CRITICAL = 2000;
const AI_JOBS_PENDING_WARN = 100;
const AI_JOBS_PENDING_CRITICAL = 500;
const CRON_WINDOW_MINUTES = 60;

function nowIso(): string {
  return new Date().toISOString();
}

function toIsoMinutesAgo(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

async function checkDatabase(admin: AdminClient): Promise<{ status: "ok" | "degraded" | "critical"; message: string }> {
  try {
    const { data, error } = await admin.from("profiles").select("id").limit(1);
    if (error) return { status: "critical", message: "unavailable" };
    return { status: "ok", message: "ok" };
  } catch {
    return { status: "critical", message: "unavailable" };
  }
}

async function checkCron(admin: AdminClient): Promise<{ status: "ok" | "degraded" | "critical"; message: string }> {
  try {
    const since = toIsoMinutesAgo(CRON_WINDOW_MINUTES);
    const res = await admin
      .from("cron_runs")
      .select("job,status,ran_at", { count: "exact" })
      .gte("ran_at", since);
    if (res.error) return { status: "degraded", message: "unavailable" };
    const total = typeof (res as any).count === "number" ? (res as any).count : (Array.isArray((res as any).data) ? (res as any).data.length : 0);
    const rows = Array.isArray((res as any).data) ? (res as any).data : [];
    const ok = rows.filter((r: any) => String(r?.status ?? "").toLowerCase() === "ok" || String(r?.status ?? "").toLowerCase() === "success").length;
    if (total === 0) return { status: "degraded", message: "no recent runs" };
    const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
    if (pct >= 90) return { status: "ok", message: `ok (${pct}% success, ${total} runs)` };
    if (pct >= 70) return { status: "degraded", message: `degraded (${pct}% success)` };
    return { status: "critical", message: `critical (${pct}% success)` };
  } catch {
    return { status: "degraded", message: "unavailable" };
  }
}

async function checkOutbox(admin: AdminClient): Promise<{ status: "ok" | "degraded" | "critical"; message: string }> {
  try {
    const res = await admin.from("outbox").select("id", { count: "exact", head: true }).eq("status", "PENDING");
    if (res.error) return { status: "degraded", message: "unavailable" };
    const count = typeof (res as any).count === "number" ? (res as any).count : 0;
    if (count <= OUTBOX_PENDING_WARN) return { status: "ok", message: `ok (${count} pending)` };
    if (count <= OUTBOX_PENDING_CRITICAL) return { status: "degraded", message: `elevated (${count} pending)` };
    return { status: "critical", message: `backlog (${count} pending)` };
  } catch {
    return { status: "degraded", message: "unavailable" };
  }
}

async function checkAiJobs(admin: AdminClient): Promise<{ status: "ok" | "degraded" | "critical"; message: string }> {
  try {
    const res = await admin.from("ai_jobs").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (res.error) return { status: "degraded", message: "unavailable" };
    const count = typeof (res as any).count === "number" ? (res as any).count : 0;
    if (count <= AI_JOBS_PENDING_WARN) return { status: "ok", message: `ok (${count} queued)` };
    if (count <= AI_JOBS_PENDING_CRITICAL) return { status: "degraded", message: `elevated (${count} queued)` };
    return { status: "critical", message: `backlog (${count} queued)` };
  } catch {
    return { status: "degraded", message: "unavailable" };
  }
}

async function checkMigrations(admin: AdminClient): Promise<{ status: "ok" | "degraded" | "critical"; message: string }> {
  try {
    const { error } = await admin.from("profiles").select("id").limit(1);
    if (error) return { status: "critical", message: "unavailable" };
    const { error: outboxError } = await admin.from("outbox").select("id").limit(1);
    if (outboxError) return { status: "degraded", message: "outbox missing" };
    return { status: "ok", message: "ok" };
  } catch {
    return { status: "degraded", message: "unavailable" };
  }
}

function checkEnvironment(): { status: "ok" | "degraded" | "critical"; message: string } {
  const report = validateSystemRuntimeEnv();
  if (report.ok) return { status: "ok", message: "ok" };
  return { status: "critical", message: "missing required env" };
}

/**
 * Run all health checks and return a single aggregated result.
 * Does not expose sensitive data (no env var names, no connection strings).
 */
export async function getSystemHealth(admin: AdminClient): Promise<SystemHealthResult> {
  const timestamp = nowIso();

  const [database, cron, outbox, aiJobs, migrations, environment] = await Promise.all([
    checkDatabase(admin),
    checkCron(admin),
    checkOutbox(admin),
    checkAiJobs(admin),
    checkMigrations(admin),
    Promise.resolve(checkEnvironment()),
  ]);

  const statuses = [database, cron, outbox, aiJobs, migrations, environment].map((r) => r.status);
  let status: SystemHealthStatus = "ok";
  if (statuses.some((s) => s === "critical")) status = "critical";
  else if (statuses.some((s) => s === "degraded")) status = "degraded";

  return {
    status,
    database: database.message,
    cron: cron.message,
    outbox: outbox.message,
    ai_jobs: aiJobs.message,
    migrations: migrations.message,
    timestamp,
  };
}
