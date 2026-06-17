import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("executeCompanyRemoval contracts", () => {
  it("hard delete rekalkulerer avhengigheter før sletting", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("freshDependencies");
    expect(src).toContain("freshEligibility");
  });

  it("hard delete rydder non-operational setup rows i riktig FK-rekkefølge", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("default_location_id: null");
    expect(src).toContain("paused_by: null");
    expect(src).toContain("suspended_by: null");
    expect(src).toContain("location_memberships");
    expect(src).toContain("company_memberships");
    expect(src).toContain("lead_pipeline");
    expect(src).toContain("agreement_change_requests");
    expect(src).toContain("agreements");
    expect(src).toContain("profiles");
    expect(src).toContain("day_choices");

    const membershipsIdx = src.indexOf('"company_memberships"');
    const profilesIdx = src.indexOf('cleanupFailureMessage("profiles"');
    expect(membershipsIdx).toBeGreaterThan(-1);
    expect(profilesIdx).toBeGreaterThan(-1);
    expect(membershipsIdx).toBeLessThan(profilesIdx);
  });

  it("pre-delete audit blokkerer ikke hard delete ved audit-feil", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("writeHardDeletePreAudit");
    expect(src).toContain("Hard delete pre-delete audit failed (continuing)");
  });

  it("auth cleanup er best-effort og feiler ikke hele slettingen", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("authPartialFailure");
    expect(src).not.toContain("throw new Error(\"AUTH_DELETE_FAILED\")");
  });

  it("hard delete returnerer konkrete DB-feilmeldinger", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("safeDbHint");
    expect(src).toContain("ukjent avhengighet");
    expect(src).toContain("profiler fortsatt er koblet");
    expect(src).toContain("lokasjoner fortsatt er koblet");
  });

  it("route returnerer 409 ved HARD_DELETE_BLOCKED og fanger execution-feil", () => {
    const route = readFileSync(join(ROOT, "app/api/superadmin/companies/[companyId]/remove/route.ts"), "utf8");
    expect(route).toContain('result.code === "HARD_DELETE_BLOCKED" ? 409');
    expect(route).toContain("try {");
    expect(route).toContain("EXECUTION_FAILED");
    expect(route).toContain("removalErrorResponse");
  });

  it("UI viser servermelding og RID i stedet for generisk feil", () => {
    const dialog = readFileSync(join(ROOT, "app/superadmin/companies/CompanyRemovalDialog.tsx"), "utf8");
    expect(dialog).toContain("ERROR_CODE_MESSAGES");
    expect(dialog).toContain("RID:");
    expect(dialog).toContain('parseApiMessage(body as ApiErr, "Handlingen feilet.", res.status)');
  });

  it("ingen Golden Path-imports i company removal", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).not.toContain("lp_order_set");
    expect(src).not.toContain("lp_order_advance_status");
  });
});
