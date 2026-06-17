import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingRelationError } from "@/lib/db/missingRelation";
import {
  isProtectedSystemCompany,
  PROTECTED_SYSTEM_COMPANY_MESSAGE,
} from "@/lib/server/superadmin/superadminEntityKind";

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
  agreementInvoices: number;
};

export type CompanyRemovalEligibility = {
  protectedPilot: boolean;
  alreadyArchived: boolean;
  dependencies: CompanyDependencyCounts;
  /** Critical operational reasons — hard-delete blocked. */
  blockers: string[];
  /** Archive-only blockers (does not affect hard-delete). */
  archiveBlockers: string[];
  /** Non-operational rows removed during safe hard-delete. */
  cleanup: string[];
  /** Informational only — does not block hard-delete. */
  warnings: string[];
  confirmationTargets: string[];
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
    agreementInvoices,
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
    countRows(db, "agreement_invoices", companyId),
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
    agreementInvoices,
  };
}

function dependencyCountFailed(d: CompanyDependencyCounts): boolean {
  return Object.values(d).some((n) => n === Number.MAX_SAFE_INTEGER);
}

/** Critical operational history — always blocks hard-delete. */
export function hasCriticalOperationalHistory(d: CompanyDependencyCounts): boolean {
  return (
    d.orders > 0 ||
    d.deliveries > 0 ||
    d.productionManifests > 0 ||
    d.invoiceLines > 0 ||
    d.agreementInvoices > 0 ||
    d.tripletexCustomers > 0 ||
    d.billingAccounts > 0 ||
    d.tripletexInvoices > 0
  );
}

function buildHardDeleteBlockers(input: {
  protectedPilot: boolean;
  protectedSystem: boolean;
  dependencies: CompanyDependencyCounts;
}): string[] {
  const d = input.dependencies;
  const blockers: string[] = [];

  if (input.protectedSystem) {
    blockers.push(PROTECTED_SYSTEM_COMPANY_MESSAGE);
  }
  if (input.protectedPilot) {
    blockers.push("Dette firmaet er beskyttet og kan ikke slettes permanent.");
  }
  if (d.orders > 0) blockers.push("Ordrehistorikk finnes.");
  if (d.invoiceLines > 0 || d.agreementInvoices > 0) blockers.push("Fakturagrunnlag finnes.");
  if (d.tripletexCustomers > 0 || d.billingAccounts > 0 || d.tripletexInvoices > 0) {
    blockers.push("Faktura/Tripletex-historikk finnes.");
  }
  if (d.deliveries > 0 || d.productionManifests > 0) blockers.push("Leveranse-/produksjonshistorikk finnes.");
  if (dependencyCountFailed(d)) {
    blockers.push("Kunne ikke verifisere alle avhengigheter — permanent sletting er blokkert.");
  }

  return blockers;
}

function buildHardDeleteCleanup(d: CompanyDependencyCounts): string[] {
  const cleanup: string[] = [];
  if (d.agreements > 0) cleanup.push("Avtaleutkast/avtaler uten ordrehistorikk");
  if (d.agreementRequests > 0) cleanup.push("Avtaleforespørsler");
  if (d.profiles > 0) cleanup.push("Profiler og testbrukere");
  if (d.companyLocations > 0) cleanup.push("Lokasjoner");
  if (d.companyRegistrations > 0) cleanup.push("Registreringsutkast");
  if (d.dayChoices > 0) cleanup.push("Meny-/lunsjvalg uten ordre");
  if (d.menuServiceDays > 0) cleanup.push("Menydager uten ordre");
  if (d.auditEvents > 0) cleanup.push("Eksisterende audit-rader (ny pre-delete audit skrives)");
  cleanup.push("Invitasjoner, legacy- og identitetsmedlemskap, pipeline og stående bestillinger uten ordre");
  return cleanup;
}

export function buildConfirmationTargets(input: {
  companyName: string | null;
  orgnr: string | null;
  companyId?: string | null;
}): string[] {
  const targets: string[] = [];
  const orgnr = safeStr(input.orgnr);
  const name = safeStr(input.companyName);
  if (orgnr) targets.push(orgnr);
  if (name) targets.push(name);
  return targets;
}

export function evaluateCompanyRemovalEligibility(input: {
  companyName: string | null;
  orgnr: string | null;
  deletedAt: string | null;
  dependencies: CompanyDependencyCounts;
}): CompanyRemovalEligibility {
  const protectedPilot = isProtectedPilotCompany(input.companyName);
  const protectedSystem = isProtectedSystemCompany({ companyName: input.companyName });
  const alreadyArchived = Boolean(safeStr(input.deletedAt));
  const hasOrgnr = Boolean(safeStr(input.orgnr));
  const hasName = Boolean(safeStr(input.companyName));
  const d = input.dependencies;

  const warnings: string[] = [];
  if (alreadyArchived) warnings.push("Firmaet er allerede arkivert.");
  if (!hasOrgnr) warnings.push("Firma mangler org.nr — bekreft med eksakt firmanavn.");

  const archiveBlockers: string[] = [];
  if (!hasOrgnr) archiveBlockers.push("Firma mangler org.nr — arkivering krever org.nr.");
  if (alreadyArchived) archiveBlockers.push("Firma er allerede arkivert.");

  if (protectedSystem) archiveBlockers.push(PROTECTED_SYSTEM_COMPANY_MESSAGE);
  if (protectedPilot) archiveBlockers.push("Dette firmaet er beskyttet og kan ikke arkiveres.");

  const hardDeleteBlockers = buildHardDeleteBlockers({ protectedPilot, protectedSystem, dependencies: d });
  const hasHardDeleteBlockers =
    protectedPilot || protectedSystem || hasCriticalOperationalHistory(d) || dependencyCountFailed(d);

  const cleanup = hasHardDeleteBlockers ? [] : buildHardDeleteCleanup(d);
  const confirmationTargets = buildConfirmationTargets({
    companyName: input.companyName,
    orgnr: input.orgnr,
  });

  return {
    protectedPilot,
    alreadyArchived,
    dependencies: d,
    blockers: hardDeleteBlockers,
    archiveBlockers,
    cleanup,
    warnings,
    confirmationTargets,
    canArchive: !alreadyArchived && hasOrgnr && archiveBlockers.length === 0,
    canHardDelete: !hasHardDeleteBlockers && (hasOrgnr || hasName),
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
