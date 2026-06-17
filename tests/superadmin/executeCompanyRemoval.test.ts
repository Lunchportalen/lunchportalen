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

  it("hard delete rydder non-operational setup rows", () => {
    const src = readFileSync(join(ROOT, "lib/server/superadmin/executeCompanyRemoval.ts"), "utf8");
    expect(src).toContain("default_location_id: null");
    expect(src).toContain("lead_pipeline");
    expect(src).toContain("agreement_change_requests");
    expect(src).toContain("agreements");
    expect(src).toContain("profiles");
    expect(src).toContain("day_choices");
  });

  it("route returnerer 409 ved HARD_DELETE_BLOCKED", () => {
    const route = readFileSync(join(ROOT, "app/api/superadmin/companies/[companyId]/remove/route.ts"), "utf8");
    expect(route).toContain('result.code === "HARD_DELETE_BLOCKED" ? 409');
  });
});
