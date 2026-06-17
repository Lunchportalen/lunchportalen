import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingRelationError } from "@/lib/db/missingRelation";

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
  dayChoices: number;
  menuServiceDays: number;
  agreementRequests: number;
  productionManifests: number;
  tripletexInvoices: number;
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
  if (error) {
    if (isMissingRelationError(error, table)) return 0;
    return Number.MAX_SAFE_INTEGER;
  }
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
    dayChoices,
    menuServiceDays,
    agreementRequests,
    productionManifests,
    tripletexInvoices,
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
    countRows(db, "day_choices", companyId),
    countRows(db, "menu_service_days", companyId),
    countRows(db, "agreement_requests", companyId),
    countRows(db, "production_manifests", companyId),
    countRows(db, "tripletex_invoices", companyId),
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
    dayChoices,
    menuServiceDays,
    agreementRequests,
    productionManifests,
    tripletexInvoices,
  };
}

function buildHardDeleteBlockers(input: {
  protectedPilot: boolean;
  dependencies: CompanyDependencyCounts;
}): string[] {
  const d = input.dependencies;
  const blockers: string[] = [];

  if (input.protectedPilot) {
    blockers.push("Dette firmaet er beskyttet og kan ikke slettes permanent.");
  }
  if (d.orders > 0) blockers.push("Ordrehistorikk finnes.");
  if (d.agreements > 0 || d.agreementRequests > 0) blockers.push("Avtalehistorikk finnes.");
  if (d.profiles > 0) blockers.push("Ansatte eller profiler finnes.");
  if (d.dayChoices > 0 || d.menuServiceDays > 0) blockers.push("Meny-/lunsjvalg finnes.");
  if (d.tripletexCustomers > 0 || d.billingAccounts > 0 || d.tripletexInvoices > 0) {
    blockers.push("Audit/faktura/Tripletex-historikk finnes.");
  }
  if (d.invoiceLines > 0) blockers.push("Fakturagrunnlag finnes.");
  if (d.deliveries > 0 || d.productionManifests > 0) blockers.push("Leveranse-/produksjonshistorikk finnes.");

  const values = Object.values(d);
  if (values.some((n) => n === Number.MAX_SAFE_INTEGER)) {
    blockers.push("Kunne ikke verifisere alle avhengigheter — permanent sletting er blokkert.");
  }

  return blockers;
}

export function evaluateCompanyRemovalEligibility(input: {
  companyName: string | null;
  orgnr: string | null;
  deletedAt: string | null;
  dependencies: CompanyDependencyCounts;
}): CompanyRemovalEligibility {
  const protectedPilot = isProtectedPilotCompany(input.companyName);
  const alreadyArchived = Boolean(safeStr(input.deletedAt));
  const hasOrgnr = Boolean(safeStr(input.orgnr));
  const d = input.dependencies;

  const archiveBlockers: string[] = [];
  if (!hasOrgnr) archiveBlockers.push("Firma mangler org.nr — arkivering krever org.nr.");
  if (alreadyArchived) archiveBlockers.push("Firma er allerede arkivert.");

  const hardDeleteBlockers = buildHardDeleteBlockers({ protectedPilot, dependencies: d });

  const hasHardDeleteBlockers =
    protectedPilot ||
    d.orders > 0 ||
    d.agreements > 0 ||
    d.agreementRequests > 0 ||
    d.profiles > 0 ||
    d.tripletexCustomers > 0 ||
    d.billingAccounts > 0 ||
    d.invoiceLines > 0 ||
    d.deliveries > 0 ||
    d.dayChoices > 0 ||
    d.menuServiceDays > 0 ||
    d.productionManifests > 0 ||
    d.tripletexInvoices > 0 ||
    Object.values(d).some((n) => n === Number.MAX_SAFE_INTEGER);

  const blockers = Array.from(new Set([...archiveBlockers, ...hardDeleteBlockers]));

  return {
    protectedPilot,
    alreadyArchived,
    dependencies: d,
    blockers,
    canArchive: !alreadyArchived && hasOrgnr,
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
