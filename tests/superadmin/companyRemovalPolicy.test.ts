import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateCompanyRemovalEligibility,
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
};

describe("companyRemovalPolicy", () => {
  it("beskytter Pettersen&Co og Melhus Catering", () => {
    expect(isProtectedPilotCompany("Pettersen&Co")).toBe(true);
    expect(isProtectedPilotCompany("Melhus Catering AS")).toBe(true);
    expect(isProtectedPilotCompany("Test Firma AS")).toBe(false);
  });

  it("blokkerer hard delete ved ordre", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, orders: 2 },
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.canArchive).toBe(true);
  });

  it("blokkerer hard delete ved avtale", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, agreements: 1 },
    });
    expect(e.canHardDelete).toBe(false);
  });

  it("blokkerer hard delete ved profiler", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, profiles: 1 },
    });
    expect(e.canHardDelete).toBe(false);
  });

  it("blokkerer hard delete ved Tripletex mapping", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: { ...ZERO, tripletexCustomers: 1 },
    });
    expect(e.canHardDelete).toBe(false);
  });

  it("blokkerer hard delete for beskyttet pilot", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Pettersen&Co",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: ZERO,
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.protectedPilot).toBe(true);
  });

  it("tillater hard delete uten avhengigheter", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Utkast Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: ZERO,
    });
    expect(e.canHardDelete).toBe(true);
  });

  it("blokkerer archive uten orgnr", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Utkast Test AS",
      orgnr: null,
      deletedAt: null,
      dependencies: ZERO,
    });
    expect(e.canArchive).toBe(false);
    expect(e.blockers.some((b) => b.includes("org.nr"))).toBe(true);
  });

  it("archive bekreftelse krever orgnr ARKIVER", () => {
    expect(matchesArchiveConfirmation({ confirmation: "123456789 ARKIVER", orgnr: "123456789" })).toBe(true);
    expect(matchesArchiveConfirmation({ confirmation: "feil", orgnr: "123456789" })).toBe(false);
  });

  it("hard delete bekreftelse matcher navn eller orgnr", () => {
    expect(
      matchesHardDeleteConfirmation({ confirmation: "Test Firma AS", companyName: "Test Firma AS", orgnr: "123456789" })
    ).toBe(true);
    expect(
      matchesHardDeleteConfirmation({ confirmation: "Feil navn", companyName: "Test Firma AS", orgnr: "123456789" })
    ).toBe(false);
  });
});

describe("Superadmin company removal UI wiring", () => {
  it("Arkiver / fjern åpner CompanyRemovalDialog via removalTarget", () => {
    const client = readFileSync(join(ROOT, "app/superadmin/companies/companies-client.tsx"), "utf8");
    expect(client).toContain("Arkiver / fjern");
    expect(client).toContain("setRemovalTarget(c)");
    expect(client).toContain("CompanyRemovalDialog");
    expect(client).toContain("sa-action-menu__panel--portal");
    expect(client).toContain("createPortal");
  });

  it("CompanyRemovalDialog kaller eligibility GET og POST remove", () => {
    const dialog = readFileSync(join(ROOT, "app/superadmin/companies/CompanyRemovalDialog.tsx"), "utf8");
    expect(dialog).toContain("/remove");
    expect(dialog).toMatch(/method:\s*"POST"/);
    expect(dialog).toContain("canHardDelete");
    expect(dialog).toContain("confirmMatches");
    expect(dialog).toContain("Firma kan arkiveres, men ikke slettes permanent");
  });

  it("remove route krever superadmin og returnerer eligibility", () => {
    const route = readFileSync(join(ROOT, "app/api/superadmin/companies/[companyId]/remove/route.ts"), "utf8");
    expect(route).toContain("isSuperadminProfile");
    expect(route).toContain("executeCompanyRemoval");
    expect(route).toContain("evaluateCompanyRemovalEligibility");
    expect(route).not.toContain("lp_order_set");
  });

  it("companies client refresher liste etter vellykket removal", () => {
    const client = readFileSync(join(ROOT, "app/superadmin/companies/companies-client.tsx"), "utf8");
    expect(client).toContain("setListRefreshKey");
    expect(client).toContain("removalSuccess");
  });
});
