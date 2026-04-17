import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Contract: manuell prod-verifikasjonsscript finnes og dokumenterer Vercel DEPLOYMENT_DISABLED.
 * Selve HTTP-kjøring skjer ikke i CI (flaky / miljøavhengig).
 */
describe("scripts/verify-production-public-cms.mjs (contract)", () => {
  test("script exists and checks DOM signals + optional strict live-umbraco", () => {
    const p = join(process.cwd(), "scripts", "verify-production-public-cms.mjs");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("data-lp-public-cms-origin");
    expect(src).toContain("data-lp-public-cms-slug");
    expect(src).toContain("DEPLOYMENT_DISABLED");
    expect(src).toContain("VERIFY_STRICT_LIVE_UMBRACO");
  });
});
