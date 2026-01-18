// lib/audit/log.ts
import { createClient } from "@supabase/supabase-js";

type Severity = "info" | "warning" | "critical";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function writeAudit(opts: {
  actor_user_id: string;
  actor_role: string;
  action: string;
  severity?: Severity;

  company_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;

  before?: any;
  after?: any;
  meta?: any;
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return; // fail-quiet (enterprise: don't break ops)

  const admin = supabaseAdmin();
  await admin.from("audit_log").insert({
    actor_user_id: opts.actor_user_id,
    actor_role: opts.actor_role,
    action: opts.action,
    severity: opts.severity ?? "info",
    company_id: opts.company_id ?? null,
    target_type: opts.target_type ?? null,
    target_id: opts.target_id ?? null,
    target_label: opts.target_label ?? null,
    before: opts.before ?? null,
    after: opts.after ?? null,
    meta: opts.meta ?? null,
  });
}
