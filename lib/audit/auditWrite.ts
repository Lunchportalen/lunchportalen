// lib/audit/auditWrite.ts
import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuditInput = {
  rid: string;
  action: string;
  entity_type: string; // e.g. "order"
  entity_id: string; // MUST be non-empty (use order.id)
  company_id?: string | null;
  location_id?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  summary?: string | null;
  detail?: any;
};

function nowIso() {
  return new Date().toISOString();
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function uuidV4(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const b = crypto.randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = b.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

/**
 * MUST-write audit event.
 * - Tries multiple column shapes (detail/payload/meta/data/context)
 * - Tries audit_events then audit_rows
 * - Throws if nothing succeeds (caller should fail route)
 */
export async function auditWriteMust(input: AuditInput): Promise<void> {
  const rid = safeStr(input.rid);
  const action = safeStr(input.action);
  const entity_type = safeStr(input.entity_type);
  const entity_id = safeStr(input.entity_id);

  if (!rid || !action || !entity_type || !entity_id) {
    throw new Error(
      `AUDIT_INVALID_INPUT: rid/action/entity_type/entity_id required (rid=${rid}, action=${action}, entity_type=${entity_type}, entity_id=${entity_id})`
    );
  }

  const admin = supabaseAdmin();

  // Common base (covers most schema variants)
  const base: any = {
    rid,
    action,
    event: action, // some tables use "event"
    entity_type,
    entity_id,
    created_at: nowIso(),

    // optional context
    company_id: input.company_id ?? null,
    location_id: input.location_id ?? null,
    actor_user_id: input.actor_user_id ?? null,
    actor_email: input.actor_email ?? null,
    actor_role: input.actor_role ?? null,
    summary: input.summary ?? null,
  };

  // Ensure entity_id is never null in any schema variant
  if (!base.entity_id) base.entity_id = uuidV4();

  const payload = typeof input.detail === "undefined" ? null : input.detail;

  const candidates: any[] = [
    { ...base, detail: payload },
    { ...base, payload },
    { ...base, meta: payload },
    { ...base, data: payload },
    { ...base, extra: payload },
    { ...base, context: payload },
  ];

  // 1) audit_events
  for (const row of candidates) {
    const { error } = await admin.from("audit_events").insert(row);
    if (!error) return;
  }

  // 2) fallback audit_rows
  for (const row of candidates) {
    const { error } = await admin.from("audit_rows").insert(row);
    if (!error) return;
  }

  throw new Error("AUDIT_INSERT_FAILED: could not insert into audit_events or audit_rows with any payload shape");
}
