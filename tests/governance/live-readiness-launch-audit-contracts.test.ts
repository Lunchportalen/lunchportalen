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

const P0_1_EVIDENCE_DOC = "docs/launch/p0-1-employee-smoke-evidence.md";
const P0_2_EVIDENCE_DOC = "docs/launch/p0-2-production-manual-smoke-evidence.md";
const P0_3_EVIDENCE_DOC = "docs/launch/p0-3-production-env-signoff-evidence.md";
const P0_4_EVIDENCE_DOC = "docs/launch/p0-4-on-call-roster-evidence.md";

const SECRET_LIKE_PATTERNS = [
  /E2E_EMPLOYEE_PASSWORD\s*=\s*\S+/,
  /E2E_EMPLOYEE_EMAIL\s*=\s*[^\s]+@[^\s]+/,
  /MELHUS_PROVIDER_ADMIN_PASSWORD\s*=\s*\S+/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/,
  /SANITY_WRITE_TOKEN\s*=\s*\S+/,
  /CRON_SECRET\s*=\s*\S+/,
  /password:\s*["'][^"']+["']/i,
];

describe("P0-1 — employee smoke evidence document guards", () => {
  test("P0-1 evidence document exists", () => {
    expect(fs.existsSync(path.join(ROOT, P0_1_EVIDENCE_DOC))).toBe(true);
  });

  test("P0-1 evidence doc does not contain secret values", () => {
    const doc = readSource(P0_1_EVIDENCE_DOC);
    for (const pattern of SECRET_LIKE_PATTERNS) {
      expect(doc).not.toMatch(pattern);
    }
    expect(doc).toMatch(/no secret values|Values not printed|not recorded/i);
  });

  test("P0-1 evidence documents credentials and Production flag check", () => {
    const doc = readSource(P0_1_EVIDENCE_DOC);
    expect(doc).toMatch(/E2E_EMPLOYEE_EMAIL/);
    expect(doc).toMatch(/E2E_EMPLOYEE_PASSWORD/);
    expect(doc).toMatch(/Production flag check|LP_MENU_PROFILE_/i);
    expect(doc).toMatch(/provider admin not reused|Provider admin not reused|not valid for employee/i);
    expect(doc).toMatch(/Golden Path|test:golden-path/);
    expect(doc).toMatch(/Forbidden field scan/i);
  });

  test("audit cannot mark P0-1 CLOSED unless evidence doc says CLOSED", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_1_EVIDENCE_DOC);
    const auditMarksP01Closed = /P0-1.*CLOSED|P0-1.*closed/i.test(audit);
    const evidenceClosed = /P0-1 status.*CLOSED|P0-1.*\*\*CLOSED\*\*/i.test(evidence);
    if (auditMarksP01Closed) {
      expect(evidenceClosed).toBe(true);
    }
  });

  test("audit cannot claim full GO while P0 blockers remain open", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_1_EVIDENCE_DOC);
    const hasOpenP0 =
      /P0-5.*OPEN|Multi-tenant manual negative test not/i.test(
        audit,
      );
    const claimsFullGo = /\|\s*\*\*GO\*\*\s*\|/.test(audit) && !audit.includes("CONDITIONAL GO");
    if (hasOpenP0) {
      expect(claimsFullGo).toBe(false);
    }
    expect(audit).toMatch(/CONDITIONAL GO/);
    if (/P0-1.*CLOSED/i.test(audit)) {
      expect(evidence).toMatch(/P0-1.*CLOSED/i);
    }
  });

  test("Production LP_MENU_PROFILE flags remain documented OFF in launch audit", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    expect(menuProfileFlagsInDoc(audit).length).toBeGreaterThanOrEqual(10);
    expect(audit).toMatch(/Launch value = OFF|launch value = OFF/i);
  });
});

describe("P0-2 — Production manual smoke evidence document guards", () => {
  test("P0-2 evidence document exists", () => {
    expect(fs.existsSync(path.join(ROOT, P0_2_EVIDENCE_DOC))).toBe(true);
  });

  test("P0-2 evidence doc does not contain secret values", () => {
    const doc = readSource(P0_2_EVIDENCE_DOC);
    for (const pattern of SECRET_LIKE_PATTERNS) {
      expect(doc).not.toMatch(pattern);
    }
    expect(doc).toMatch(/no secret values|Values not printed|not recorded/i);
  });

  test("P0-2 evidence documents Production §9 smoke and flag check", () => {
    const doc = readSource(P0_2_EVIDENCE_DOC);
    expect(doc).toMatch(/app\.lunchportalen\.no/);
    expect(doc).toMatch(/Manual smoke checklist|§9 steps A–M/i);
    expect(doc).toMatch(/Provider login|Employee.*week|order/i);
    expect(doc).toMatch(/LP_MENU_PROFILE_/i);
    expect(doc).toMatch(/Golden Path|test:golden-path/);
    expect(doc).toMatch(/Forbidden field|leakage scan/i);
    expect(doc).toMatch(/cleanup|cancel/i);
  });

  test("audit cannot mark P0-2 CLOSED unless evidence doc says CLOSED", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_2_EVIDENCE_DOC);
    const auditMarksP02Closed = /P0-2.*CLOSED|P0-2.*closed/i.test(audit);
    const evidenceClosed = /P0-2 status.*CLOSED|P0-2.*\*\*CLOSED\*\*/i.test(evidence);
    if (auditMarksP02Closed) {
      expect(evidenceClosed).toBe(true);
    }
  });

  test("audit cannot claim full GO while P0-3..P0-5 remain open", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_2_EVIDENCE_DOC);
    const hasOpenP0 =
      /P0-5.*OPEN|Multi-tenant manual negative test not/i.test(
        audit + evidence,
      );
    const claimsFullGo = /\|\s*\*\*GO\*\*\s*\|/.test(audit) && !audit.includes("CONDITIONAL GO");
    if (hasOpenP0) {
      expect(claimsFullGo).toBe(false);
    }
    expect(audit).toMatch(/CONDITIONAL GO/);
    if (/P0-2.*CLOSED/i.test(audit)) {
      expect(evidence).toMatch(/P0-2.*CLOSED/i);
    }
  });

  test("P0-2 evidence does not claim G5d.8 / cutover / auto-rollout started", () => {
    const doc = readSource(P0_2_EVIDENCE_DOC);
    expect(doc).toMatch(/no G5d\.8|G5d\.8 · cutover|no cutover|no auto-rollout/i);
    expect(doc).not.toMatch(/G5d\.8 started|cutover complete|auto-rollout enabled/i);
  });
});

describe("P0-3 — Production env sign-off evidence document guards", () => {
  test("P0-3 evidence document exists", () => {
    expect(fs.existsSync(path.join(ROOT, P0_3_EVIDENCE_DOC))).toBe(true);
  });

  test("P0-3 evidence doc does not contain secret values", () => {
    const doc = readSource(P0_3_EVIDENCE_DOC);
    for (const pattern of SECRET_LIKE_PATTERNS) {
      expect(doc).not.toMatch(pattern);
    }
    expect(doc).toMatch(/no secret values|Values not printed|not recorded|Secret leak/i);
  });

  test("P0-3 evidence documents env audit and flag matrix", () => {
    const doc = readSource(P0_3_EVIDENCE_DOC);
    expect(doc).toMatch(/app\.lunchportalen\.no/);
    expect(doc).toMatch(/vercel env ls production|Env category matrix/i);
    expect(doc).toMatch(/LP_MENU_PROFILE_/);
    expect(doc).toMatch(/Owner sign-off|sign-off statement/i);
    expect(doc).toMatch(/SYSTEM_MOTOR_SECRET|NEXT_PUBLIC_SUPABASE/);
    expect(doc).toMatch(/Golden Path|test:golden-path/);
    expect(doc).toMatch(/zero entries|absent|OFF/i);
  });

  test("audit cannot mark P0-3 CLOSED unless evidence doc says CLOSED", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_3_EVIDENCE_DOC);
    const auditMarksP03Closed = /P0-3.*CLOSED|P0-3.*closed/i.test(audit);
    const evidenceClosed = /P0-3 status.*CLOSED|P0-3.*\*\*CLOSED\*\*/i.test(evidence);
    if (auditMarksP03Closed) {
      expect(evidenceClosed).toBe(true);
    }
  });

  test("audit cannot claim full GO while P0-5 remains open", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_3_EVIDENCE_DOC);
    const hasOpenP0 =
      /P0-5.*OPEN|Multi-tenant manual negative test not/i.test(
        audit + evidence,
      );
    const claimsFullGo = /\|\s*\*\*GO\*\*\s*\|/.test(audit) && !audit.includes("CONDITIONAL GO");
    if (hasOpenP0) {
      expect(claimsFullGo).toBe(false);
    }
    expect(audit).toMatch(/CONDITIONAL GO/);
    if (/P0-3.*CLOSED/i.test(audit)) {
      expect(evidence).toMatch(/P0-3.*CLOSED/i);
    }
  });

  test("P0-3 evidence does not claim G5d.8 / cutover / auto-rollout started", () => {
    const doc = readSource(P0_3_EVIDENCE_DOC);
    expect(doc).toMatch(/no G5d\.8|G5d\.8 · cutover|no cutover|no auto-rollout/i);
    expect(doc).not.toMatch(/G5d\.8 started|cutover complete|auto-rollout enabled/i);
  });
});

describe("P0-4 — on-call roster evidence document guards", () => {
  test("P0-4 evidence document exists", () => {
    expect(fs.existsSync(path.join(ROOT, P0_4_EVIDENCE_DOC))).toBe(true);
  });

  test("P0-4 evidence doc does not contain secret values or phone numbers", () => {
    const doc = readSource(P0_4_EVIDENCE_DOC);
    for (const pattern of SECRET_LIKE_PATTERNS) {
      expect(doc).not.toMatch(pattern);
    }
    expect(doc).toMatch(/no phone numbers|Contact leak|no secret values/i);
    expect(doc).not.toMatch(/\+47\s*\d{2}/);
  });

  test("P0-4 evidence documents on-call roster and escalation path", () => {
    const doc = readSource(P0_4_EVIDENCE_DOC);
    expect(doc).toMatch(/Primary on-call|primary on-call/i);
    expect(doc).toMatch(/Backup on-call|backup on-call/i);
    expect(doc).toMatch(/Thomas Johansen/);
    expect(doc).toMatch(/Support contact|post@lunchportalen\.no/i);
    expect(doc).toMatch(/48-hour launch watch|48-hour/i);
    expect(doc).toMatch(/Escalation path|escalation path/i);
    expect(doc).toMatch(/SLO_ALERTING_RUNBOOK|RECOVERY_PLAYBOOK/i);
    expect(doc).toMatch(/Golden Path|test:golden-path/);
  });

  test("audit cannot mark P0-4 CLOSED unless evidence doc says CLOSED", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_4_EVIDENCE_DOC);
    const auditMarksP04Closed = /P0-4.*CLOSED|P0-4.*closed/i.test(audit);
    const evidenceClosed = /P0-4 status.*CLOSED|P0-4.*\*\*CLOSED\*\*/i.test(evidence);
    if (auditMarksP04Closed) {
      expect(evidenceClosed).toBe(true);
    }
  });

  test("audit cannot claim full GO while P0-5 remains open", () => {
    const audit = readSource(LAUNCH_AUDIT_DOC);
    const evidence = readSource(P0_4_EVIDENCE_DOC);
    const hasOpenP0 =
      /P0-5.*OPEN|Multi-tenant manual negative test not/i.test(
        audit + evidence,
      );
    const claimsFullGo = /\|\s*\*\*GO\*\*\s*\|/.test(audit) && !audit.includes("CONDITIONAL GO");
    if (hasOpenP0) {
      expect(claimsFullGo).toBe(false);
    }
    expect(audit).toMatch(/CONDITIONAL GO/);
    if (/P0-4.*CLOSED/i.test(audit)) {
      expect(evidence).toMatch(/P0-4.*CLOSED/i);
    }
  });

  test("P0-4 evidence does not claim G5d.8 / cutover / auto-rollout started", () => {
    const doc = readSource(P0_4_EVIDENCE_DOC);
    expect(doc).toMatch(/no G5d\.8|G5d\.8 · cutover|no cutover|no auto-rollout/i);
    expect(doc).not.toMatch(/G5d\.8 started|cutover complete|auto-rollout enabled/i);
  });
});
