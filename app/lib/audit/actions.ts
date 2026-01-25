// lib/audit/actions.ts
import { writeAudit, type Severity } from "@/lib/audit/log";

/**
 * Standardisert audit-helper for Lunchportalen.
 * - Fail-quiet: writeAudit kaster ikke, så dette kan brukes overalt uten risiko.
 * - Normaliserer felter og sikrer at company_id alltid settes når vi har den.
 * - Legger location_id inn i meta for konsistent filtrering i ettertid.
 */

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function safeJson(v: any) {
  if (v === undefined) return null;
  return v;
}

export async function auditAdmin(opts: {
  actor_user_id: string;
  actor_role?: Role; // default company_admin
  actor_email?: string | null;

  action: string;
  severity?: Severity;

  company_id: string | null;
  location_id?: string | null;

  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;

  before?: any;
  after?: any;
  meta?: any;
}) {
  const meta = {
    ...(opts.meta ?? {}),
    location_id: opts.location_id ?? null,
    source: (opts.meta && typeof opts.meta === "object" && "source" in opts.meta) ? (opts.meta as any).source : "server",
  };

  return writeAudit({
    actor_user_id: opts.actor_user_id,
    actor_role: opts.actor_role ?? "company_admin",
    action: opts.action,
    severity: opts.severity ?? "info",

    company_id: opts.company_id ?? null,

    // disse er valgfrie i audit_events, men supernyttig for revisjon
    target_type: safeText(opts.target_type),
    target_id: safeText(opts.target_id),
    target_label: safeText(opts.target_label),

    before: safeJson(opts.before),
    after: safeJson(opts.after),
    meta: safeJson(meta),
  });
}

/**
 * Superadmin audit-helper (for statusendringer, avtaler, sperring osv.)
 */
export async function auditSuperadmin(opts: {
  actor_user_id: string;
  actor_email?: string | null;

  action: string;
  severity?: Severity;

  company_id?: string | null;
  location_id?: string | null;

  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;

  before?: any;
  after?: any;
  meta?: any;
}) {
  const meta = {
    ...(opts.meta ?? {}),
    location_id: opts.location_id ?? null,
    source: (opts.meta && typeof opts.meta === "object" && "source" in opts.meta) ? (opts.meta as any).source : "server",
  };

  return writeAudit({
    actor_user_id: opts.actor_user_id,
    actor_role: "superadmin",
    action: opts.action,
    severity: opts.severity ?? "info",

    company_id: opts.company_id ?? null,

    target_type: safeText(opts.target_type),
    target_id: safeText(opts.target_id),
    target_label: safeText(opts.target_label),

    before: safeJson(opts.before),
    after: safeJson(opts.after),
    meta: safeJson(meta),
  });
}

/**
 * Kritiske systemhendelser (brukes ved exceptions, datafeil, integritetsbrudd)
 */
export async function auditCritical(opts: {
  actor_user_id: string;
  actor_role: Role;
  action: string;
  company_id?: string | null;
  location_id?: string | null;
  meta?: any;
}) {
  const meta = {
    ...(opts.meta ?? {}),
    location_id: opts.location_id ?? null,
    source: "system",
  };

  return writeAudit({
    actor_user_id: opts.actor_user_id,
    actor_role: opts.actor_role,
    action: opts.action,
    severity: "critical",
    company_id: opts.company_id ?? null,
    target_type: "system",
    target_id: null,
    target_label: null,
    before: null,
    after: null,
    meta: safeJson(meta),
  });
}
