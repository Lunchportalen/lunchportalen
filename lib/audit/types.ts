/**
 * Legacy audit pipeline → `audit_events` (see `lib/audit/log.ts`).
 */
export type AuditAction = string;

export type AuditEvent = {
  action: AuditAction;
  userId: string | null;
  role: string | null;
  companyId: string | null;
  locationId: string | null;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  timestamp: number;
  rid: string;
};

/**
 * Enterprise append-only spor (`audit_logs`) + compliance / superadmin revisjon.
 * Skilt fra legacy {@link AuditEvent} for å unngå kontraktkollisjon.
 */
export type AuditEventSource = "system" | "user" | "ai";

export type EnterpriseAuditEvent = {
  id: string;
  timestamp: number;

  actor: {
    id: string | null;
    role: string;
  };

  action: string;
  entity: string;
  entityId?: string;

  before?: unknown;
  after?: unknown;

  metadata?: Record<string, unknown>;

  source: AuditEventSource;
};
