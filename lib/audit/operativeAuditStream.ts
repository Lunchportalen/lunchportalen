/**
 * Superadmin drift: filtrering og kontekstlenker for canonical `audit_events`
 * (samme tabell som writeAuditEvent — ingen ny loggkilde).
 */

export type AuditStreamItem = {
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  detail?: unknown;
};

function isUuid(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i.test(v);
}

/** PostgREST `.or(...)` for operative hendelser som faktisk skrives i repoet. */
export const OPERATIVE_AUDIT_EVENTS_OR =
  "action.ilike.%agreement.%,action.eq.COMPANY_STATUS_CHANGED,action.eq.agreement.status,action.eq.COMPANY_CREATED";

export function extractCompanyIdFromAuditDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const o = detail as Record<string, unknown>;
  const c = o.company_id ?? o.companyId;
  if (typeof c === "string" && isUuid(c.trim())) return c.trim();
  return null;
}

/**
 * Lenker til eksisterende superadmin-flater (best-effort ut fra entity + detail).
 */
export function resolveSuperadminAuditContextLinks(it: AuditStreamItem): Array<{ label: string; href: string }> {
  const et = String(it.entity_type ?? "").trim().toLowerCase();
  const eid = String(it.entity_id ?? "").trim();
  const companyId = extractCompanyIdFromAuditDetail(it.detail);
  const out: Array<{ label: string; href: string }> = [];

  if (et === "agreement" && isUuid(eid)) {
    out.push({ label: "Avtale", href: `/superadmin/agreements/${encodeURIComponent(eid)}` });
  }
  if (et === "company" && isUuid(eid)) {
    out.push({ label: "Firma", href: `/superadmin/companies/${encodeURIComponent(eid)}` });
  }
  if (companyId) {
    out.push({ label: "Registrering", href: `/superadmin/registrations/${encodeURIComponent(companyId)}` });
    if (et !== "company" || eid !== companyId) {
      out.push({ label: "Firma", href: `/superadmin/companies/${encodeURIComponent(companyId)}` });
    }
  }
  if (et === "company_agreement" && companyId) {
    out.push({ label: "Firma", href: `/superadmin/companies/${encodeURIComponent(companyId)}` });
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.href)) return false;
    seen.add(x.href);
    return true;
  });
}
