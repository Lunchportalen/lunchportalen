import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseDbDependencyError } from "@/lib/server/superadmin/executeCompanyRemoval";

const ROOT = process.cwd();

describe("parseDbDependencyError", () => {
  it("parser FK-feil med tabell og constraint", () => {
    const parsed = parseDbDependencyError({
      code: "23503",
      message:
        'update or delete on table "company_locations" violates foreign key constraint "memberships_location_id_fkey" on table "memberships"',
    });
    expect(parsed.isFkViolation).toBe(true);
    expect(parsed.table).toBe("memberships");
    expect(parsed.constraint).toBe("memberships_location_id_fkey");
  });
});

describe("executeCompanyRemoval contracts", () => {
  it("hard delete rekalkulerer avhengigheter før sletting", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("freshDependencies");
    expect(src).toContain("freshEligibility");
  });

  it("hard delete rydder spine memberships og standing_orders før lokasjoner", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain('"standing_orders"');
    expect(src).toContain('from("memberships").delete().eq("org_id"');
    expect(src).toContain('from("organizations").delete().eq("id"');

    const spineIdx = src.indexOf("deleteSpineMembershipsByOrgId");
    const standingIdx = src.indexOf('"standing_orders"');
    const locDelIdx = src.indexOf('buildCleanupFailure("company_locations"');
    expect(spineIdx).toBeGreaterThan(-1);
    expect(standingIdx).toBeGreaterThan(-1);
    expect(locDelIdx).toBeGreaterThan(-1);
    expect(spineIdx).toBeLessThan(locDelIdx);
    expect(standingIdx).toBeLessThan(locDelIdx);
  });

  it("hard delete rydder legacy memberships før profiler", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    const membershipsIdx = src.indexOf('"company_memberships"');
    const profilesIdx = src.indexOf('buildCleanupFailure("profiles"');
    expect(membershipsIdx).toBeGreaterThan(-1);
    expect(profilesIdx).toBeGreaterThan(-1);
    expect(membershipsIdx).toBeLessThan(profilesIdx);
  });

  it("unknown dependency returnerer tabell/constraint/cleanupStep", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("UNKNOWN_DEPENDENCY");
    expect(src).toContain("dependencyDetail");
    expect(src).toContain("logCleanupFailure");
    expect(src).toContain("fortsatt er koblet til firmaet");
    expect(src).not.toContain("ukjent avhengighet");
  });

  it("pre-delete audit blokkerer ikke hard delete ved audit-feil", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("writeHardDeletePreAudit");
    expect(src).toContain("Hard delete pre-delete audit failed (continuing)");
  });

  it("route sender dependency detail i error response", () => {
    const route = readFileSync(join(ROOT, "app/api/superadmin/companies/[companyId]/remove/route.ts"), "utf8");
    expect(route).toContain("cleanupStep");
    expect(route).toContain("dependencyDetail");
  });

  it("UI viser servermelding og RID", () => {
    const dialog = readFileSync(join(ROOT, "app/superadmin/companies/CompanyRemovalDialog.tsx"), "utf8");
    expect(dialog).toContain("UNKNOWN_DEPENDENCY");
    expect(dialog).toContain("RID:");
  });

  it("ingen Golden Path-imports i company removal", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).not.toContain("lp_order_set");
    expect(src).not.toContain("lp_order_advance_status");
  });
});
