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

const ZERO_DEPS: CompanyDependencyCounts = {
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
      deletedAt: null,
      dependencies: { ...ZERO_DEPS, orders: 2 },
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.blockers.some((b) => b.includes("ordre"))).toBe(true);
    expect(e.canArchive).toBe(true);
  });

  it("blokkerer hard delete ved avtale", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      deletedAt: null,
      dependencies: { ...ZERO_DEPS, agreements: 1 },
    });
    expect(e.canHardDelete).toBe(false);
  });

  it("blokkerer hard delete ved Tripletex mapping", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      deletedAt: null,
      dependencies: { ...ZERO_DEPS, tripletexCustomers: 1 },
    });
    expect(e.canHardDelete).toBe(false);
  });

  it("blokkerer hard delete for beskyttet pilot", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Pettersen&Co",
      deletedAt: null,
      dependencies: ZERO_DEPS,
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.protectedPilot).toBe(true);
  });

  it("tillater hard delete uten avhengigheter", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Utkast Test AS",
      deletedAt: null,
      dependencies: ZERO_DEPS,
    });
    expect(e.canHardDelete).toBe(true);
  });

  it("archive bekreftelse krever orgnr ARKIVER", () => {
    expect(matchesArchiveConfirmation({ confirmation: "123456789 ARKIVER", orgnr: "123456789" })).toBe(true);
    expect(matchesArchiveConfirmation({ confirmation: "123456789 SLETT", orgnr: "123456789" })).toBe(true);
    expect(matchesArchiveConfirmation({ confirmation: "feil", orgnr: "123456789" })).toBe(false);
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

  it("archive tillates ikke når allerede arkivert", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      deletedAt: "2026-01-01T00:00:00Z",
      dependencies: ZERO_DEPS,
    });
    expect(e.canArchive).toBe(false);
    expect(e.alreadyArchived).toBe(true);
  });
});

describe("Superadmin companies enterprise surface (source contracts)", () => {
  it("companies client bruker enterprise table uten vertikal statusvegg", () => {
    const src = readFileSync(join(process.cwd(), "app/superadmin/companies/companies-client.tsx"), "utf8");
    expect(src).toContain("sa-enterprise-table");
    expect(src).not.toContain("Registrering → avtale (ledger)");
    expect(src).toContain("CompanyRemovalDialog");
    expect(src).toContain("sa-row-detail");
  });

  it("shell støtter full-width flat workspace uten outer frame", () => {
    const shell = readFileSync(join(process.cwd(), "components/superadmin/shell/SuperadminShell.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "app/styles/ds/superadmin-shell.css"), "utf8");
    const layout = readFileSync(join(process.cwd(), "app/superadmin/layout.tsx"), "utf8");
    expect(shell).toContain("sa-page--full");
    expect(css).toContain(".sa-page--full");
    expect(layout).toContain("lp-app-shell__workspace");
    expect(layout).not.toContain("lp-app-shell__frame");
  });

  it("remove route krever superadmin og validerer server-side", () => {
    const route = readFileSync(join(process.cwd(), "app/api/superadmin/companies/[companyId]/remove/route.ts"), "utf8");
    expect(route).toContain("isSuperadminProfile");
    expect(route).toContain("executeCompanyRemoval");
    expect(route).toContain('mode === "hard_delete"');
    expect(route).not.toContain("lp_order_set");
  });
});
