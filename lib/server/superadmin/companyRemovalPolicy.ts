import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

const PROTECTED_NAME_PATTERNS = [/pettersen\s*&?\s*co/i, /melhus\s+catering/i];

export type CompanyDependencyCounts = {
  orders: number;
  agreements: number;
  profiles: number;
  tripletexCustomers: number;
  billingAccounts: number;
  auditEvents: number;
  companyRegistrations: number;
  companyLocations: number;
  invoiceLines: number;
  deliveries: number;
};

export type CompanyRemovalEligibility = {
  protectedPilot: boolean;
  alreadyArchived: boolean;
  dependencies: CompanyDependencyCounts;
  blockers: string[];
  canArchive: boolean;
  canHardDelete: boolean;
};

export function isProtectedPilotCompany(name: string | null | undefined): boolean {
  const n = safeStr(name);
  if (!n) return false;
  return PROTECTED_NAME_PATTERNS.some((pattern) => pattern.test(n));
}

async function countRows(
  db: SupabaseClient,
  table: string,
  companyId: string,
  column = "company_id"
): Promise<number> {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(column, companyId);
  if (error) return Number.MAX_SAFE_INTEGER;
  return Number.isFinite(Number(count)) ? Number(count) : 0;
}

export async function loadCompanyDependencyCounts(
  db: SupabaseClient,
  companyId: string
): Promise<CompanyDependencyCounts> {
  const [
    orders,
    agreements,
    profiles,
    tripletexCustomers,
    billingAccounts,
    auditEvents,
    companyRegistrations,
    companyLocations,
    invoiceLines,
    deliveries,
  ] = await Promise.all([
    countRows(db, "orders", companyId),
    countRows(db, "agreements", companyId),
    countRows(db, "profiles", companyId),
    countRows(db, "tripletex_customers", companyId),
    countRows(db, "company_billing_accounts", companyId),
    countRows(db, "audit_events", companyId),
    countRows(db, "company_registrations", companyId),
    countRows(db, "company_locations", companyId),
    countRows(db, "invoice_lines", companyId),
    countRows(db, "deliveries", companyId),
  ]);

  return {
    orders,
    agreements,
    profiles,
    tripletexCustomers,
    billingAccounts,
    auditEvents,
    companyRegistrations,
    companyLocations,
    invoiceLines,
    deliveries,
  };
}

export function evaluateCompanyRemovalEligibility(input: {
  companyName: string | null;
  deletedAt: string | null;
  dependencies: CompanyDependencyCounts;
}): CompanyRemovalEligibility {
  const protectedPilot = isProtectedPilotCompany(input.companyName);
  const alreadyArchived = Boolean(safeStr(input.deletedAt));
  const d = input.dependencies;
  const blockers: string[] = [];

  if (protectedPilot) {
    blockers.push("Beskyttet pilotfirma kan ikke slettes permanent.");
  }
  if (d.orders > 0) blockers.push(`${d.orders} ordre finnes — historikk må bevares.`);
  if (d.agreements > 0) blockers.push(`${d.agreements} avtale(r) finnes.`);
  if (d.profiles > 0) blockers.push(`${d.profiles} ansatt(e)/profil(er) finnes.`);
  if (d.tripletexCustomers > 0) blockers.push("Tripletex-kobling finnes.");
  if (d.billingAccounts > 0) blockers.push("Fakturakonto/Tripletex-mapping finnes.");
  if (d.auditEvents > 0) blockers.push(`${d.auditEvents} audit-hendelse(r) finnes — slettes ikke.`);
  if (d.invoiceLines > 0) blockers.push(`${d.invoiceLines} fakturalinje(r) finnes.`);
  if (d.deliveries > 0) blockers.push(`${d.deliveries} leveranse(r) finnes.`);

  const hasHardDeleteBlockers =
    protectedPilot ||
    d.orders > 0 ||
    d.agreements > 0 ||
    d.profiles > 0 ||
    d.tripletexCustomers > 0 ||
    d.billingAccounts > 0 ||
    d.auditEvents > 0 ||
    d.invoiceLines > 0 ||
    d.deliveries > 0;

  return {
    protectedPilot,
    alreadyArchived,
    dependencies: d,
    blockers,
    canArchive: !alreadyArchived,
    canHardDelete: !hasHardDeleteBlockers && !alreadyArchived,
  };
}

export function matchesHardDeleteConfirmation(input: {
  confirmation: string;
  companyName: string | null;
  orgnr: string | null;
}): boolean {
  const confirm = safeStr(input.confirmation);
  if (!confirm) return false;
  const name = safeStr(input.companyName);
  const orgnr = safeStr(input.orgnr);
  return (name.length > 0 && confirm === name) || (orgnr.length > 0 && confirm === orgnr);
}

export function matchesArchiveConfirmation(input: { confirmation: string; orgnr: string | null }): boolean {
  const orgnr = safeStr(input.orgnr);
  if (!orgnr) return false;
  const confirm = safeStr(input.confirmation);
  return confirm === `${orgnr} ARKIVER` || confirm === `${orgnr} SLETT`;
}
