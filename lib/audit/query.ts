import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

import { detectSuspicious, type SuspiciousAuditHint } from "@/lib/audit/security";

export type EnterpriseAuditQueryFilters = {
  /** ISO timestamp — inclusive lower bound on `created_at` */
  since?: string;
  /** ISO timestamp — inclusive upper bound on `created_at` */
  until?: string;
  /** Exact match on `action` */
  action?: string;
  /** Case-insensitive substring match on `action` */
  actionIlike?: string;
  userId?: string;
  companyId?: string;
  /** Matched against `resource` (substring, ILIKE) */
  entity?: string;
  /** Exact match on `metadata->>entity_id` (tekst) */
  entityId?: string;
  source?: "system" | "user" | "ai";
  /** Exclusive upper bound — rows strictly older than this ISO timestamp */
  olderThan?: string;
  limit?: number;
};

export type EnterpriseAuditLogRow = {
  id: string;
  created_at: string;
  action: string;
  resource: string;
  user_id: string | null;
  company_id: string | null;
  metadata: Record<string, unknown>;
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * Query append-only enterprise rows in `audit_logs` (`metadata.enterprise_audit_layer`).
 */
export async function getAuditLogs(filters: EnterpriseAuditQueryFilters = {}): Promise<EnterpriseAuditLogRow[]> {
  if (!hasSupabaseAdminConfig()) {
    return [];
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, typeof filters.limit === "number" && Number.isFinite(filters.limit) ? Math.floor(filters.limit) : DEFAULT_LIMIT),
  );

  try {
    const admin = supabaseAdmin();
    let q = admin
      .from("audit_logs")
      .select("id,created_at,action,resource,user_id,company_id,metadata")
      .contains("metadata", { enterprise_audit_layer: true })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filters.since) {
      q = q.gte("created_at", filters.since);
    }
    if (filters.until) {
      q = q.lte("created_at", filters.until);
    }
    if (filters.actionIlike && filters.actionIlike.trim()) {
      const a = filters.actionIlike.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
      q = q.ilike("action", `%${a}%`);
    } else if (filters.action && filters.action.trim()) {
      q = q.eq("action", filters.action.trim());
    }
    if (filters.userId && filters.userId.trim()) {
      q = q.eq("user_id", filters.userId.trim());
    }
    if (filters.companyId && filters.companyId.trim()) {
      q = q.eq("company_id", filters.companyId.trim());
    }
    if (filters.olderThan) {
      q = q.lt("created_at", filters.olderThan);
    }
    if (filters.source) {
      q = q.filter("metadata->>source", "eq", filters.source);
    }
    if (filters.entity && filters.entity.trim()) {
      const safe = filters.entity.trim().replace(/[%_]/g, "");
      if (safe) {
        q = q.ilike("resource", `%${safe}%`);
      }
    }
    if (filters.entityId && filters.entityId.trim()) {
      q = q.filter("metadata->>entity_id", "eq", filters.entityId.trim());
    }

    const { data, error } = await q;
    if (error || !Array.isArray(data)) {
      return [];
    }

    return data.map((row) => ({
      id: String((row as { id?: unknown }).id ?? ""),
      created_at: String((row as { created_at?: unknown }).created_at ?? ""),
      action: String((row as { action?: unknown }).action ?? ""),
      resource: String((row as { resource?: unknown }).resource ?? ""),
      user_id:
        (row as { user_id?: unknown }).user_id != null ? String((row as { user_id: unknown }).user_id) : null,
      company_id:
        (row as { company_id?: unknown }).company_id != null
          ? String((row as { company_id: unknown }).company_id)
          : null,
      metadata:
        (row as { metadata?: unknown }).metadata && typeof (row as { metadata: unknown }).metadata === "object"
          ? ((row as { metadata: Record<string, unknown> }).metadata as Record<string, unknown>)
          : {},
    })).filter((r) => r.id.length > 0 && r.created_at.length > 0);
  } catch {
    return [];
  }
}

export type ControlTowerAuditSnapshot = {
  recent: Array<{
    id: string;
    created_at: string;
    action: string;
    resource: string;
    source: string | null;
    actor_role: string | null;
  }>;
  suspicious24h: SuspiciousAuditHint;
  complianceStatus: "ok" | "review";
};

/** Maps append-only `audit_logs` row → superadmin audit list row (aligned with `audit_events` UI). */
export function enterpriseAuditRowToSuperadminListItem(row: EnterpriseAuditLogRow): {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  detail: unknown;
  audit_stream: "audit_logs";
} {
  const meta = row.metadata ?? {};
  const source = typeof meta.source === "string" ? meta.source : "unknown";
  const ent = typeof meta.entity === "string" ? meta.entity : row.resource.split("#")[0] ?? row.resource;
  const eid = meta.entity_id != null ? String(meta.entity_id) : row.resource.includes("#") ? row.resource.split("#").slice(1).join("#") : "";

  return {
    id: row.id,
    created_at: row.created_at,
    actor_user_id: row.user_id,
    actor_email: null,
    actor_role: typeof meta.actor_role === "string" ? meta.actor_role : null,
    action: row.action,
    entity_type: ent || null,
    entity_id: eid || null,
    summary: `${source} · ${row.action}`,
    detail: {
      before: meta.before ?? null,
      after: meta.after ?? null,
      source: meta.source ?? null,
      resource: row.resource,
      company_id: row.company_id,
      event_id: meta.event_id ?? null,
      timestamp_ms: meta.timestamp_ms ?? null,
      extra: meta,
    },
    audit_stream: "audit_logs",
  };
}

export async function getControlTowerAuditSnapshot(): Promise<ControlTowerAuditSnapshot> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [recent, last24h] = await Promise.all([
    getAuditLogs({ limit: 12 }),
    getAuditLogs({ since, limit: 400 }),
  ]);

  const suspicious24h = detectSuspicious(last24h);

  return {
    recent: recent.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      action: r.action,
      resource: r.resource,
      source: typeof r.metadata.source === "string" ? r.metadata.source : null,
      actor_role: typeof r.metadata.actor_role === "string" ? r.metadata.actor_role : null,
    })),
    suspicious24h,
    complianceStatus: suspicious24h ? "review" : "ok",
  };
}
