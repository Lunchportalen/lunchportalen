import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuthContext } from "@/lib/auth/getAuthContext";
import type { AuthedCtx } from "@/lib/http/routeGuard";
import { ctxSnapshot } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

import type { AuditAction, AuditEvent } from "@/lib/audit/types";
import { makeRid } from "@/lib/http/respond";

export type { AuditAction, AuditEvent } from "@/lib/audit/types";

export type Severity = "info" | "warning" | "critical";

export type WriteAuditInput = {
  actor_user_id: string;
  actor_role: string;
  action: string;
  severity: Severity;
  company_id?: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  before: unknown;
  after: unknown;
  meta: unknown;
};

type AuditPartial = {
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

function roleStr(role: unknown): string | null {
  if (role === null || role === undefined) return null;
  const s = String(role).trim();
  return s || null;
}

/** Build event from `getAuthContext()` output. */
export function buildAuditEvent(ctx: Pick<AuthContext, "rid" | "userId" | "role" | "company_id" | "location_id">, partial: AuditPartial): AuditEvent {
  return {
    action: partial.action,
    userId: ctx.userId ?? null,
    role: roleStr(ctx.role),
    companyId: ctx.company_id ?? null,
    locationId: ctx.location_id ?? null,
    resource: partial.resource,
    resourceId: partial.resourceId ?? null,
    metadata: partial.metadata ?? {},
    timestamp: Date.now(),
    rid: ctx.rid,
  };
}

/** Build event from `scopeOr401` / `AuthedCtx` (API routes). */
export function buildAuditEventFromAuthedCtx(ctx: AuthedCtx, partial: AuditPartial): AuditEvent {
  const snap = ctxSnapshot(ctx);
  return {
    action: partial.action,
    userId: snap.userId,
    role: roleStr(snap.role),
    companyId: snap.companyId,
    locationId: snap.locationId,
    resource: partial.resource,
    resourceId: partial.resourceId ?? null,
    metadata: {
      ...partial.metadata,
      ...(snap.route ? { surface: snap.route } : {}),
    },
    timestamp: Date.now(),
    rid: ctx.rid,
  };
}

function trimMeta(m: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!m) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "string") out[k] = v.length > 500 ? `${v.slice(0, 500)}…` : v;
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (typeof v === "object" && v !== null && !Array.isArray(v)) out[k] = "[object]";
    else out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

async function persistAuditEvent(ev: AuditEvent): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;

  const entityId = String(ev.resourceId ?? ev.rid).slice(0, 500);
  const row = {
    actor_user_id: ev.userId,
    actor_email: null as string | null,
    actor_role: ev.role,
    action: ev.action,
    entity_type: ev.resource.slice(0, 120),
    entity_id: entityId || ev.rid,
    summary: `${ev.action}:${ev.resource}`.slice(0, 500),
    detail: {
      audit_rid: ev.rid,
      company_id: ev.companyId,
      location_id: ev.locationId,
      ts: ev.timestamp,
      ...trimMeta(ev.metadata),
    },
  };

  const { error } = await supabaseAdmin().from("audit_events").insert(row as any);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[audit:insert_failed]", { rid: ev.rid, code: error.code, message: error.message });
  }
}

/**
 * Fire-and-forget audit. Never throws to callers; DB failures are console-only.
 */
export function auditLog(event: AuditEvent): void {
  try {
    if (process.env.NODE_ENV !== "production" || process.env.LP_DEBUG_AUDIT === "1") {
      // eslint-disable-next-line no-console
      console.log("[audit]", {
        action: event.action,
        rid: event.rid,
        resource: event.resource,
        resourceId: event.resourceId ?? null,
        userId: event.userId,
        role: event.role,
        companyId: event.companyId,
        locationId: event.locationId,
        metadata: trimMeta(event.metadata),
        ts: event.timestamp,
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[audit:console_error]", e);
  }

  void (async () => {
    try {
      await persistAuditEvent(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[audit:error]", err);
    }
  })();
}

/** Kompatibilitet med eldre kall — mapper til {@link auditLog} / audit_events. */
export async function writeAudit(p: WriteAuditInput): Promise<void> {
  const rid = makeRid("audit");
  const extra =
    p.meta && typeof p.meta === "object" && !Array.isArray(p.meta) ? (p.meta as Record<string, unknown>) : {};
  const event: AuditEvent = {
    action: "UPDATE",
    userId: p.actor_user_id,
    role: String(p.actor_role ?? "").trim() || null,
    companyId: p.company_id ?? null,
    locationId: null,
    resource: p.target_type?.trim() ? p.target_type.slice(0, 120) : "audit",
    resourceId: p.target_id,
    metadata: {
      severity: p.severity,
      audit_action: p.action,
      target_label: p.target_label,
      before: p.before,
      after: p.after,
      ...extra,
    },
    timestamp: Date.now(),
    rid,
  };
  auditLog(event);
}

/** Structured audit row for `system_settings` updates (maps to `audit_events` columns). Never throws. */
export type StructuredSettingsAuditInput = {
  rid: string;
  actorUserId: string | null;
  actorEmail: string | null;
  payload: {
    toggles: unknown;
    killswitch: unknown;
    retention: unknown;
  };
};

export async function recordStructuredSettingsAudit(
  sb: SupabaseClient<Database>,
  input: StructuredSettingsAuditInput
): Promise<void> {
  try {
    const { error } = await sb.from("audit_events").insert({
      rid: input.rid,
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail,
      actor_role: "superadmin",
      action: "SETTINGS_UPDATED",
      entity_type: "system_settings",
      entity_id: "global",
      summary: "Systeminnstillinger oppdatert",
      detail: input.payload as any,
    } as any);
    if (error) {
      console.error("[AUDIT_SETTINGS_FAILED]", { rid: input.rid, message: error.message, code: error.code });
    }
  } catch (err) {
    console.error("[AUDIT_SETTINGS_FAILED]", err);
  }
}

/** Autonomy control-cycle actions — append-only `audit_events`. Never throws. */
export async function recordAutonomyActionAudit(
  sb: SupabaseClient<Database>,
  input: { rid: string; actorUserId: string | null; payload: unknown }
): Promise<void> {
  try {
    const { error } = await sb.from("audit_events").insert({
      rid: input.rid,
      actor_user_id: input.actorUserId,
      actor_role: "system",
      action: "AUTONOMY_ACTION",
      entity_type: "autonomy_control",
      entity_id: "cycle",
      summary: "Autonomy control cycle",
      detail: input.payload as any,
    } as any);
    if (error) {
      console.error("[AUDIT_AUTONOMY_FAILED]", { rid: input.rid, message: error.message, code: error.code });
    }
  } catch (err) {
    console.error("[AUDIT_AUTONOMY_FAILED]", err);
  }
}
