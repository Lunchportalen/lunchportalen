/**
 * SMART-4 housekeeping — static staging evidence document contract.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const EVIDENCE = "docs/architecture/smart-menu-smart-4-staging-evidence.md";
const ARCHITECTURE = "docs/architecture/smart-menu-language-profile-currency.md";
const SMART4_MERGE_SHA = "d017709ad8811219293c601183b88f0ed943d2a5";

const SECRET_PATTERNS = [
  /password\s*=\s*[^\s\n]+/i,
  /access_token\s*=\s*[^\s\n]+/i,
  /refresh_token\s*=\s*[^\s\n]+/i,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
  /service_role\s*=\s*[^\s\n]+/i,
  /postgresql:\/\/[^\s\n]+:[^\s\n]+@/i,
] as const;

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("SMART-4 — staging evidence housekeeping", () => {
  test("evidence document exists and references SMART-4 merge SHA", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(new RegExp(SMART4_MERGE_SHA));
    expect(doc).toMatch(/PR #398/);
  });

  test("evidence documents staging deploy and API PASS", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/staging\.app\.lunchportalen\.no/i);
    expect(doc).toMatch(/origin\/staging/i);
    expect(doc).toMatch(/Deploy verdict.*PASS|PASS.*Deploy verdict/i);
    expect(doc).toMatch(/GET \/api\/provider\/menu-translations\/sources.*200|200.*sources/i);
    expect(doc).toMatch(/405.*METHOD_NOT_ALLOWED|POST.*405/i);
    expect(doc).toMatch(/401.*UNAUTHORIZED|Unauthenticated.*401/i);
    expect(doc).toMatch(/403.*FORBIDDEN|Employee.*403/i);
    expect(doc).toMatch(/26 candidates|26.*candidates/i);
  });

  test("evidence states provider-side scope and employee guard preserved", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/provider-side only|Provider-side only/i);
    expect(doc).toMatch(/Employee runtime identity change|no employee overlay logic changed/i);
    expect(doc).toMatch(/AI translation|autotranslation/i);
    expect(doc).toMatch(/auto-approve/i);
    expect(doc).toMatch(/order identity/i);
    expect(doc).toMatch(/SMART-3 fail-closed|fail-closed overlay/i);
  });

  test("evidence states explicit non-events", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/Production touched.*NO|NO.*Production touched/i);
    expect(doc).toMatch(/LP_MENU_PROFILE_/);
    expect(doc).toMatch(/G5d\.8.*NOT started|NOT started.*G5d\.8/i);
    expect(doc).toMatch(/cutover/i);
    expect(doc).toMatch(/source-of-truth/i);
    expect(doc).toMatch(/auto-rollout/i);
  });

  test("evidence documents known risks", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/main.*staging.*manual|manual.*main.*staging/i);
    expect(doc).toMatch(/catalog-only/i);
    expect(doc).toMatch(/client-hydrated/i);
  });

  test("evidence contains no secrets", () => {
    const doc = read(EVIDENCE);
    for (const pattern of SECRET_PATTERNS) {
      expect(doc, `evidence must not match ${pattern}`).not.toMatch(pattern);
    }
  });

  test("architecture doc links to SMART-4 staging evidence", () => {
    const doc = read(ARCHITECTURE);
    expect(doc).toMatch(/smart-menu-smart-4-staging-evidence\.md/);
    expect(doc).toMatch(/Staging PASS/i);
    expect(doc).toMatch(/PR #398/);
    expect(doc).toMatch(/d017709a/);
  });
});
