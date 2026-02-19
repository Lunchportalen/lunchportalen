// lib/ops/logOpsEvent.ts
import "server-only";

type OpsEvent = {
  rid?: string | null;

  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;

  action: string;
  entity_type: string;
  entity_id?: string | null;

  summary?: string | null;
  detail?: any;
};

/**
 * Best-effort audit logging.
 * - MUST NEVER throw (do not break create/approve/status flows)
 * - Uses service-role Supabase client (supabaseAdmin / server client with elevated rights)
 */
export async function logOpsEventBestEffort(admin: any, evt: OpsEvent) {
  try {
    const row = {
      rid: evt.rid ?? null,
      actor_user_id: evt.actor_user_id ?? null,
      actor_email: evt.actor_email ?? null,
      actor_role: evt.actor_role ?? null,
      action: String(evt.action ?? "").trim(),
      entity_type: String(evt.entity_type ?? "").trim(),
      entity_id: evt.entity_id ?? null,
      summary: evt.summary ?? null,
      detail: evt.detail ?? {},
    };

    if (!row.action || !row.entity_type) return;

    // Prefer canonical ops_events; fall back to audit_events if you insist.
    const { error } = await admin.from("ops_events").insert(row);
    if (error) {
      // If ops_events is not deployed yet but audit_events exists, try it.
      await admin.from("audit_events").insert(row);
    }
  } catch {
    // best effort only
  }
}
