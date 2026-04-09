/**
 * Aggregates lightweight metrics for system graph (ai_activity_log + counts + revenue).
 * Server-only; uses supabaseAdmin.
 */
import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "graph_metrics";

export type ApiMetric = {
  errors: number;
  latency: number | null;
  successRate: number;
  count: number;
  lastError: string | null;
  lastActivityAt: string | null;
};

export type DbMetric = {
  rows: number | null;
  recentWrites: number;
};

export type RevenueMetric = {
  revenue: number;
};

export type GraphMetricsPayload = {
  windowHours: number;
  generatedAt: string;
  api: Record<string, ApiMetric>;
  db: Record<string, DbMetric>;
  revenue: Record<string, RevenueMetric>;
  health: { aiLogOk: boolean; databaseReachable: boolean };
};

function extractApiPathFromMetadata(m: unknown): string | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  for (const key of ["path", "route", "apiPath", "url"]) {
    const v = o[key];
    if (typeof v === "string") {
      const s = v.split("?")[0].trim();
      if (s.startsWith("/api/")) return s;
    }
  }
  return null;
}

function rowLooksError(action: string, m: unknown): boolean {
  const a = String(action ?? "").toLowerCase();
  if (a.includes("error") || a.includes("fail")) return true;
  if (m && typeof m === "object") {
    const o = m as Record<string, unknown>;
    if (o.error != null) return true;
    if (o.status === "error") return true;
    if (typeof o.ok === "boolean" && o.ok === false) return true;
  }
  return false;
}

function errMessage(m: unknown): string | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  const e = o.error ?? o.message;
  if (typeof e === "string" && e.trim()) return e.slice(0, 200);
  return null;
}

const PRIORITY_TABLES = [
  "lead_pipeline",
  "orders",
  "social_posts",
  "profiles",
  "ai_activity_log",
  "companies",
  "content_pages",
] as const;

export async function buildGraphMetricsPayload(opts?: {
  windowHours?: number;
  activityLimit?: number;
}): Promise<GraphMetricsPayload> {
  const windowHours = Math.min(48, Math.max(1, opts?.windowHours ?? 6));
  const activityLimit = Math.min(5000, Math.max(500, opts?.activityLimit ?? 3000));
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const sinceWrites = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const out: GraphMetricsPayload = {
    windowHours,
    generatedAt: new Date().toISOString(),
    api: {},
    db: {},
    revenue: {},
    health: { aiLogOk: false, databaseReachable: false },
  };

  if (!hasSupabaseAdminConfig()) {
    return out;
  }

  const admin = supabaseAdmin();

  const ping = await admin.from("profiles").select("id").limit(1);
  out.health.databaseReachable = !ping.error;

  const logOk = await verifyTable(admin, "ai_activity_log", ROUTE);
  out.health.aiLogOk = logOk;

  if (logOk) {
    const { data: rows, error } = await admin
      .from("ai_activity_log")
      .select("action, metadata, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(activityLimit);

    if (!error && Array.isArray(rows)) {
      const byPath: Record<string, { total: number; errors: number; lastErr: string | null; lastAt: string | null }> =
        {};

      for (const raw of rows) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const action = typeof r.action === "string" ? r.action : "";
        const meta = r.metadata;
        const createdAt = typeof r.created_at === "string" ? r.created_at : "";
        const path = extractApiPathFromMetadata(meta) ?? (action.startsWith("/api/") ? action.split("?")[0] : null);
        if (!path) continue;

        if (!byPath[path]) {
          byPath[path] = { total: 0, errors: 0, lastErr: null, lastAt: null };
        }
        const b = byPath[path];
        b.total += 1;
        if (rowLooksError(action, meta)) {
          b.errors += 1;
          if (!b.lastErr) b.lastErr = errMessage(meta) ?? action;
        }
        if (!b.lastAt && createdAt) b.lastAt = createdAt;
      }

      for (const [path, v] of Object.entries(byPath)) {
        const successRate = v.total > 0 ? Math.max(0, Math.min(1, (v.total - v.errors) / v.total)) : 1;
        out.api[path] = {
          errors: v.errors,
          latency: null,
          successRate,
          count: v.total,
          lastError: v.lastErr,
          lastActivityAt: v.lastAt,
        };
      }
    }
  }

  for (const table of PRIORITY_TABLES) {
    const ok = await verifyTable(admin, table, ROUTE);
    if (!ok) continue;
    const countRes = await admin.from(table).select("*", { count: "exact", head: true });
    const rows = typeof countRes.count === "number" ? countRes.count : null;

    let recentWrites = 0;
    const wr = await admin.from(table).select("id", { count: "exact", head: true }).gte("created_at", sinceWrites);
    if (!wr.error && typeof wr.count === "number") recentWrites = wr.count;
    else recentWrites = 0;

    out.db[table] = { rows, recentWrites };
  }

  const ordersOk = await verifyTable(admin, "orders", ROUTE);
  if (ordersOk) {
    const { data: ord } = await admin
      .from("orders")
      .select("line_total, social_post_id, attribution")
      .or("social_post_id.not.is.null,attribution.not.is.null")
      .limit(2000);

    let totalRev = 0;
    const byPost: Record<string, number> = {};
    if (Array.isArray(ord)) {
      for (const raw of ord) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Record<string, unknown>;
        let pid: string | null =
          typeof o.social_post_id === "string" && o.social_post_id.trim() ? o.social_post_id.trim() : null;
        if (!pid && o.attribution && typeof o.attribution === "object" && !Array.isArray(o.attribution)) {
          const p = (o.attribution as Record<string, unknown>).postId;
          if (typeof p === "string" && p.trim()) pid = p.trim();
        }
        let lt = 0;
        const x = o.line_total;
        if (typeof x === "number" && Number.isFinite(x)) lt = x;
        else if (typeof x === "string" && x.trim()) {
          const n = Number(x);
          if (Number.isFinite(n)) lt = n;
        }
        totalRev += lt;
        if (pid) {
          byPost[pid] = (byPost[pid] ?? 0) + lt;
        }
      }
    }
    out.revenue.orders = { revenue: Math.round(totalRev * 100) / 100 };
    out.revenue.social_posts = { revenue: Math.round(totalRev * 100) / 100 };

    let maxPost = 0;
    let topId = "";
    for (const [id, v] of Object.entries(byPost)) {
      if (v > maxPost) {
        maxPost = v;
        topId = id;
      }
    }
    if (topId) {
      out.revenue[`social_post:${topId}`] = { revenue: Math.round(maxPost * 100) / 100 };
    }
  }

  return out;
}
