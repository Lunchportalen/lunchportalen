/**
 * Live readiness launch audit — document contract guards (docs-only).
 * Ensures enterprise production readiness audit exists and locks launch policy.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const LAUNCH_AUDIT_DOC = "docs/launch/enterprise-production-readiness-audit.md";
const MENU_PROFILE_FLAG_PATTERN = /LP_MENU_PROFILE_[A-Z_]+/g;

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function menuProfileFlagsInDoc(doc: string): string[] {
  return [...new Set(doc.match(MENU_PROFILE_FLAG_PATTERN) ?? [])];
}

describe("Live readiness — enterprise production launch audit document guards", () => {
  test("launch audit document exists", () => {
    expect(fs.existsSync(path.join(ROOT, LAUNCH_AUDIT_DOC))).toBe(true);
  });

  test("Production menu-profile flags documented OFF for launch", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    const flags = menuProfileFlagsInDoc(doc);
    expect(flags.length).toBeGreaterThanOrEqual(10);
    expect(doc).toMatch(/Production flag matrix|flag matrix/i);
    expect(doc).toMatch(/OFF|unset/i);
    expect(doc).toMatch(/Launch value = OFF|launch value = OFF/i);
  });

  test("Golden Path launch contract exists in audit doc", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/Golden Path launch contract/i);
    expect(doc).toMatch(/npm run test:golden-path/);
    expect(doc).toMatch(/lp_order_set/);
    expect(doc).toMatch(/PROTECTED_GOLDEN_PATH/);
  });

  test("smoke credentials requirement documented", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/E2E_EMPLOYEE_EMAIL/);
    expect(doc).toMatch(/E2E_EMPLOYEE_PASSWORD/);
    expect(doc).toMatch(/provider admin is invalid|provider admin is not valid|not valid for.*employee/i);
    expect(doc).toMatch(/missing|Missing|AUTH_BLOCKED/i);
  });

  test("no G5d.8 before explicit GO", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/G5d\.8/);
    expect(doc).toMatch(/not.*live|Out of scope|postponed|frozen|OFF/i);
    expect(doc).not.toMatch(/start G5d\.8|activate G5d\.8|G5d\.8 go live/i);
  });

  test("no Production menu-profile activation without final GO", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/Production.*OFF|flags.*OFF|must remain OFF/i);
    expect(doc).toMatch(
      /no Production.*flag activation|not activate Production|final GO sign-off/i,
    );
    expect(doc).not.toMatch(/enable.*Production.*LP_MENU_PROFILE|Production ON/i);
  });

  test("rollback plan exists", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/Rollback plan|rollback plan/i);
    expect(doc).toMatch(/revert|redeploy|unset/i);
    expect(doc).toMatch(/Golden Path fails|Golden Path fail/i);
  });

  test("launch blockers section exists with P0 categorization", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/Launch blockers|launch blockers/i);
    expect(doc).toMatch(/P0/);
    expect(doc).toMatch(/employee smoke credentials|Golden Path|Production env/i);
  });

  test("48-hour launch watch section exists", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/48-hour launch watch|48-hour/i);
    expect(doc).toMatch(/first order|First order/i);
    expect(doc).toMatch(/rollback decision/i);
  });

  test("executive go/no-go recommendation present", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/Executive decision|Go\/no-go recommendation/i);
    expect(doc).toMatch(/CONDITIONAL GO|NO-GO|GO/);
  });

  test("manual smoke plan and automated gates documented", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/Manual smoke plan/i);
    expect(doc).toMatch(/Automated gates/i);
    expect(doc).toMatch(/npm run typecheck/);
    expect(doc).toMatch(/ci:commercial-hardcodes-guard/);
  });
});

describe("Live readiness — audit doc scope guard (docs-only PR)", () => {
  test("audit declares no runtime changes in this PR", () => {
    const doc = readSource(LAUNCH_AUDIT_DOC);
    expect(doc).toMatch(/docs-only|no runtime changes|read-only audit/i);
  });
});
