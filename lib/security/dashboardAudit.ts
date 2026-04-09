import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export type SecurityAuditEvent = {
  id: string;
  created_at: string;
  rid: string | null;
  effectiveRid: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  detail: Record<string, unknown> | null;
};

export type SecurityDashboardMetrics = {
  totalEvents24h: number;
  tenantViolations24h: number;
  failedLogins24h: number;
  aiExecutions24h: number;
  accessDenied24h: number;
  health: "OK" | "WARNING" | "CRITICAL";
  metricsSource: "counts" | "sample" | "unavailable";
};

const MS_24H = 24 * 60 * 60 * 1000;

function isoSince24h(): string {
  return new Date(Date.now() - MS_24H).toISOString();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function effectiveRidFromRow(row: { rid?: unknown; detail?: unknown }): string {
  const top = row.rid != null ? String(row.rid).trim() : "";
  if (top) return top;
  const d = asRecord(row.detail);
  const ar = d?.audit_rid != null ? String(d.audit_rid).trim() : "";
  if (ar) return ar;
  return "—";
}

function normalizeRow(x: Record<string, unknown>): SecurityAuditEvent {
  const detail = asRecord(x.detail);
  const ridTop = x.rid != null ? String(x.rid).trim() : null;
  return {
    id: String(x.id ?? ""),
    created_at: String(x.created_at ?? ""),
    rid: ridTop || null,
    effectiveRid: effectiveRidFromRow(x),
    actor_user_id: x.actor_user_id != null ? String(x.actor_user_id) : null,
    actor_email: x.actor_email != null ? String(x.actor_email) : null,
    actor_role: x.actor_role != null ? String(x.actor_role) : null,
    action: x.action != null ? String(x.action) : null,
    entity_type: x.entity_type != null ? String(x.entity_type) : null,
    entity_id: x.entity_id != null ? String(x.entity_id) : null,
    summary: x.summary != null ? String(x.summary) : null,
    detail,
  };
}

function computeHealth(m: {
  tenantViolations24h: number;
  accessDenied24h: number;
}): "OK" | "WARNING" | "CRITICAL" {
  const tv = m.tenantViolations24h;
  const ad = m.accessDenied24h;
  if (tv >= 3) return "CRITICAL";
  if (ad >= 1 || (tv >= 1 && tv < 3)) return "WARNING";
  return "OK";
}

function aggregateFromSample(events: SecurityAuditEvent[], sinceMs: number): Omit<SecurityDashboardMetrics, "metricsSource"> {
  const inWindow = events.filter((e) => {
    const t = Date.parse(e.created_at);
    return Number.isFinite(t) && t >= sinceMs;
  });
  let tenantViolations24h = 0;
  let failedLogins24h = 0;
  let aiExecutions24h = 0;
  let accessDenied24h = 0;
  for (const e of inWindow) {
    const a = e.action ?? "";
    if (a === "TENANT_VIOLATION") tenantViolations24h += 1;
    if (a === "ACCESS_DENIED") accessDenied24h += 1;
    if (a === "AI_EXECUTION") aiExecutions24h += 1;
    if (a === "LOGIN") {
      const o = e.detail?.outcome;
      if (String(o) === "failure") failedLogins24h += 1;
    }
  }
  return {
    totalEvents24h: inWindow.length,
    tenantViolations24h,
    failedLogins24h,
    aiExecutions24h,
    accessDenied24h,
    health: computeHealth({ tenantViolations24h, accessDenied24h }),
  };
}

/**
 * Read-only: last N audit rows + best-effort 24h counters (no new HTTP APIs).
 */
export async function fetchSecurityDashboardData(limit = 100): Promise<{
  loadError: string | null;
  events: SecurityAuditEvent[];
  metrics: SecurityDashboardMetrics;
}> {
  const sinceMs = Date.now() - MS_24H;
  const emptyMetrics: SecurityDashboardMetrics = {
    totalEvents24h: 0,
    tenantViolations24h: 0,
    failedLogins24h: 0,
    aiExecutions24h: 0,
    accessDenied24h: 0,
    health: "OK",
    metricsSource: "unavailable",
  };

  if (!hasSupabaseAdminConfig()) {
    return {
      loadError: "Audit-kilde utilgjengelig (mangler service role-konfigurasjon).",
      events: [],
      metrics: { ...emptyMetrics, metricsSource: "unavailable" },
    };
  }

  try {
    const admin = supabaseAdmin();
    const sinceIso = isoSince24h();

    const { data: rows, error } = await admin
      .from("audit_events")
      .select("id,created_at,rid,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,summary,detail")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        loadError: error.message || "Kunne ikke lese audit_events.",
        events: [],
        metrics: { ...emptyMetrics, metricsSource: "unavailable" },
      };
    }

    const events = (rows ?? []).map((x) => normalizeRow(x as Record<string, unknown>));

    let metricsSource: SecurityDashboardMetrics["metricsSource"] = "sample";
    let totalEvents24h = 0;
    let tenantViolations24h = 0;
    let failedLogins24h = 0;
    let aiExecutions24h = 0;
    let accessDenied24h = 0;

    try {
      const countBase = () =>
        admin.from("audit_events").select("id", { count: "exact", head: true }).gte("created_at", sinceIso);

      const [rTotal, rTv, rAd, rAi, rFailLogin] = await Promise.all([
        countBase(),
        admin
          .from("audit_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sinceIso)
          .eq("action", "TENANT_VIOLATION"),
        admin
          .from("audit_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sinceIso)
          .eq("action", "ACCESS_DENIED"),
        admin
          .from("audit_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sinceIso)
          .eq("action", "AI_EXECUTION"),
        admin
          .from("audit_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sinceIso)
          .eq("action", "LOGIN")
          .eq("detail->>outcome", "failure"),
      ]);

      const ok =
        !rTotal.error &&
        !rTv.error &&
        !rAd.error &&
        !rAi.error &&
        !rFailLogin.error &&
        typeof rTotal.count === "number";

      if (ok) {
        metricsSource = "counts";
        totalEvents24h = rTotal.count ?? 0;
        tenantViolations24h = rTv.count ?? 0;
        accessDenied24h = rAd.count ?? 0;
        aiExecutions24h = rAi.count ?? 0;
        failedLogins24h = rFailLogin.count ?? 0;
      }
    } catch {
      metricsSource = "sample";
    }

    if (metricsSource === "sample") {
      const s = aggregateFromSample(events, sinceMs);
      totalEvents24h = s.totalEvents24h;
      tenantViolations24h = s.tenantViolations24h;
      failedLogins24h = s.failedLogins24h;
      aiExecutions24h = s.aiExecutions24h;
      accessDenied24h = s.accessDenied24h;
    }

    const health = computeHealth({ tenantViolations24h, accessDenied24h });

    return {
      loadError: null,
      events,
      metrics: {
        totalEvents24h,
        tenantViolations24h,
        failedLogins24h,
        aiExecutions24h,
        accessDenied24h,
        health,
        metricsSource,
      },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadError: msg || "Ukjent feil ved lesing av audit.",
      events: [],
      metrics: { ...emptyMetrics, metricsSource: "unavailable" },
    };
  }
}
