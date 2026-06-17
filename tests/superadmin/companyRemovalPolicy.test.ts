import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildConfirmationTargets,
  evaluateCompanyRemovalEligibility,
  hasCriticalOperationalHistory,
  isProtectedPilotCompany,
  matchesArchiveConfirmation,
  matchesHardDeleteConfirmation,
  type CompanyDependencyCounts,
} from "@/lib/server/superadmin/companyRemovalPolicy";

const ROOT = process.cwd();
const ZERO: CompanyDependencyCounts = {
  orders: 0,
  agreements: 0,
  profiles: 0,
  tripletexCustomers: 0,
  billingAccounts: 0,
  auditEvents: 0,
  companyRegistrations: 0,
  companyLocations: 0,
  invoiceLines: 0,
  deliveries: 0,
  dayChoices: 0,
  menuServiceDays: 0,
  agreementRequests: 0,
  productionManifests: 0,
  tripletexInvoices: 0,
  agreementInvoices: 0,
};

describe("companyRemovalPolicy", () => {
  it("beskytter Pettersen&Co og Melhus Catering", () => {
    expect(isProtectedPilotCompany("Pettersen&Co")).toBe(true);
    expect(isProtectedPilotCompany("Melhus Catering AS")).toBe(true);
    expect(isProtectedPilotCompany("Test Firma AS")).toBe(false);
  });

  it("already archived blokkerer ikke hard-delete", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "FX Paused 4ee27d",
      orgnr: "623466172",
      deletedAt: "2026-01-01T00:00:00Z",
      dependencies: { ...ZERO, profiles: 2, agreements: 1, dayChoices: 3, menuServiceDays: 1 },
    });
    expect(e.canHardDelete).toBe(true);
    expect(e.alreadyArchived).toBe(true);
    expect(e.canArchive).toBe(false);
    expect(e.warnings.some((w) => w.includes("allerede arkivert"))).toBe(true);
    expect(e.cleanup.length).toBeGreaterThan(0);
  });

  it("manglende orgnr blokkerer ikke hard-delete når navn finnes", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test Utkast AS",
      orgnr: null,
      deletedAt: null,
      dependencies: ZERO,
    });
    expect(e.canHardDelete).toBe(true);
    expect(e.canArchive).toBe(false);
    expect(e.warnings.some((w) => w.includes("org.nr"))).toBe(true);
    expect(buildConfirmationTargets({ companyName: "Test Utkast AS", orgnr: null })).toEqual(["Test Utkast AS"]);
  });

  it("profiler uten ordrehistorikk er cleanup, ikke blocker", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, profiles: 3 },
    });
    expect(e.canHardDelete).toBe(true);
    expect(e.blockers).toHaveLength(0);
    expect(e.cleanup.some((c) => c.includes("Profiler"))).toBe(true);
  });

  it("lokasjoner uten ordre er cleanup, ikke blocker", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, companyLocations: 2 },
    });
    expect(e.canHardDelete).toBe(true);
    expect(e.cleanup.some((c) => c.includes("Lokasjoner"))).toBe(true);
  });

  it("meny/day setup uten ordre er cleanup, ikke blocker", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, dayChoices: 5, menuServiceDays: 2, agreements: 1, agreementRequests: 1 },
    });
    expect(e.canHardDelete).toBe(true);
    expect(e.cleanup.some((c) => c.includes("Meny"))).toBe(true);
    expect(e.cleanup.some((c) => c.includes("Avtale"))).toBe(true);
  });

  it("audit-only setup blokkerer ikke hard-delete", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, auditEvents: 4 },
    });
    expect(e.canHardDelete).toBe(true);
    expect(e.cleanup.some((c) => c.includes("audit"))).toBe(true);
  });

  it("ordre blokkerer hard-delete", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, orders: 1 },
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.blockers).toContain("Ordrehistorikk finnes.");
  });

  it("faktura/Tripletex blokkerer hard-delete", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, tripletexCustomers: 1 },
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.blockers.some((b) => b.includes("Tripletex"))).toBe(true);
  });

  it("leveranse/production manifests blokkerer hard-delete", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, deliveries: 1 },
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.blockers.some((b) => b.includes("Leveranse"))).toBe(true);
  });

  it("beskyttet pilot blokkerer hard-delete", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Pettersen&Co",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: ZERO,
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.protectedPilot).toBe(true);
  });

  it("ukjent dependency count fail-closer", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, orders: Number.MAX_SAFE_INTEGER },
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.blockers.some((b) => b.includes("Kunne ikke verifisere"))).toBe(true);
  });

  it("hasCriticalOperationalHistory skiller kritisk fra setup", () => {
    expect(hasCriticalOperationalHistory({ ...ZERO, profiles: 5, agreements: 2 })).toBe(false);
    expect(hasCriticalOperationalHistory({ ...ZERO, orders: 1 })).toBe(true);
    expect(hasCriticalOperationalHistory({ ...ZERO, agreementInvoices: 1 })).toBe(true);
  });

  it("hard delete bekreftelse matcher navn eller orgnr", () => {
    expect(
      matchesHardDeleteConfirmation({ confirmation: "Test Firma AS", companyName: "Test Firma AS", orgnr: "123456789" })
    ).toBe(true);
    expect(
      matchesHardDeleteConfirmation({ confirmation: "123456789", companyName: "Test Firma AS", orgnr: "123456789" })
    ).toBe(true);
    expect(
      matchesHardDeleteConfirmation({ confirmation: "Feil navn", companyName: "Test Firma AS", orgnr: "123456789" })
    ).toBe(false);
  });

  it("archive bekreftelse krever orgnr ARKIVER", () => {
    expect(matchesArchiveConfirmation({ confirmation: "123456789 ARKIVER", orgnr: "123456789" })).toBe(true);
    expect(matchesArchiveConfirmation({ confirmation: "feil", orgnr: "123456789" })).toBe(false);
  });
});

describe("Superadmin company removal UI wiring", () => {
  it("dialog skiller warnings, blockers og cleanup", () => {
    const dialog = readFileSync(join(ROOT, "app/superadmin/companies/CompanyRemovalDialog.tsx"), "utf8");
    expect(dialog).toContain("cleanup");
    expect(dialog).toContain("warnings");
    expect(dialog).toContain("Firma kan ikke slettes permanent");
    expect(dialog).toContain("Følgende oppstartsdata ryddes");
    expect(dialog).not.toContain("Firma kan ikke fjernes");
  });

  it("executeCompanyRemoval rydder agreements og profiler ved hard delete", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain('"agreements"');
    expect(src).toContain('"profiles"');
    expect(src).toContain('"company_memberships"');
    expect(src).toContain('"day_choices"');
    expect(src).toContain("writeHardDeletePreAudit");
    expect(src).not.toContain("lp_order_set");
  });

  it("policy cleanup inkluderer identitetsmedlemskap og stående bestillinger", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/companyRemovalPolicy.ts"), "utf8");
    expect(src).toContain("identitetsmedlemskap");
    expect(src).toContain("stående bestillinger");
  });
});
