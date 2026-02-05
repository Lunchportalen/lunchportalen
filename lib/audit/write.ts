// lib/audit/write.ts
import { supabaseAdmin } from "@/lib/supabase/admin";

type AnyScope = {
  role?: string | null;
  user_id?: string | null;
  email?: string | null;
  user_email?: string | null;
};

export type AuditInsert = {
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string | null;
  detail: any | null;
};

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export function scopeActor(scope: AnyScope) {
  const actor_user_id = safeText((scope as any)?.user_id);
  const actor_email = safeText((scope as any)?.email ?? (scope as any)?.user_email);
  const actor_role = safeText((scope as any)?.role);
  return { actor_user_id, actor_email, actor_role };
}

export async function writeAuditEvent(input: Omit<AuditInsert, "actor_user_id" | "actor_email" | "actor_role"> & { scope: AnyScope }) {
  const admin = supabaseAdmin();
  const actor = scopeActor(input.scope);

  const row: AuditInsert = {
    actor_user_id: actor.actor_user_id,
    actor_email: actor.actor_email,
    actor_role: actor.actor_role,
    action: String(input.action),
    entity_type: String(input.entity_type),
    entity_id: String(input.entity_id),
    summary: input.summary ?? null,
    detail: input.detail ?? null,
  };

  const ins = await admin.from("audit_events").insert(row as any).select("id, created_at").single();

  if (ins.error) {
    return { ok: false as const, error: ins.error };
  }
  return { ok: true as const, audit: ins.data };
}
