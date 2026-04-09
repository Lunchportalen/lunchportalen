import "server-only";

import { randomUUID } from "node:crypto";

import type { AuditEventSource, EnterpriseAuditEvent } from "@/lib/audit/types";
import { scheduleAuditEvent } from "@/lib/security/audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function safeResource(entity: string, entityId?: string): string {
  const e = String(entity ?? "").trim().slice(0, 200);
  if (!entityId) return e || "unknown";
  const id = String(entityId).trim().slice(0, 240);
  return id ? `${e}#${id}` : e;
}

function pickCompanyId(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.companyId ?? metadata.company_id;
  if (typeof raw === "string" && isUuid(raw.trim())) return raw.trim();
  return null;
}

/**
 * Convenience builder for call-sites (deterministic id + timestamp).
 */
export function createAuditEvent(args: {
  action: string;
  entity: string;
  entityId?: string;
  actor: { id: string | null; role: string };
  source: AuditEventSource;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}): EnterpriseAuditEvent {
  return {
    id: randomUUID(),
    timestamp: Date.now(),
    actor: { id: args.actor.id, role: String(args.actor.role ?? "").trim() || "unknown" },
    action: String(args.action ?? "").trim() || "unknown",
    entity: String(args.entity ?? "").trim() || "unknown",
    entityId: args.entityId,
    before: args.before,
    after: args.after,
    metadata: args.metadata,
    source: args.source,
  };
}

/**
 * Enterprise audit trail: console + append-only `audit_logs` (via service role).
 * Never throws; persistence failures must not affect primary flows.
 */
export async function logAudit(event: EnterpriseAuditEvent): Promise<void> {
  try {
    // eslint-disable-next-line no-console -- explicit audit stream (financial trace)
    console.log("[AUDIT]", JSON.stringify(event));
  } catch {
    /* ignore */
  }

  try {
    const metaIn = event.metadata && typeof event.metadata === "object" ? { ...event.metadata } : {};
    const companyId = pickCompanyId(metaIn);

    const userId =
      event.actor.id != null && typeof event.actor.id === "string" && isUuid(event.actor.id.trim())
        ? event.actor.id.trim()
        : null;

    const enforced: Record<string, unknown> = {
      enterprise_audit_layer: true,
      event_id: event.id,
      timestamp_ms: event.timestamp,
      source: event.source,
      actor_role: event.actor.role,
      actor_id_raw: event.actor.id,
      entity: event.entity,
      entity_id: event.entityId ?? null,
      before: event.before ?? null,
      after: event.after ?? null,
    };

    const metadata: Record<string, unknown> = { ...metaIn, ...enforced };

    scheduleAuditEvent({
      companyId,
      userId,
      action: String(event.action ?? "").trim().slice(0, 200) || "unknown",
      resource: safeResource(event.entity, event.entityId).slice(0, 500),
      metadata,
    });
  } catch {
    /* ignore — fail-safe */
  }
}
