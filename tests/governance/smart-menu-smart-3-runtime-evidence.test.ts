/**
 * SMART-3 housekeeping — static runtime evidence document contract.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const EVIDENCE = "docs/architecture/smart-menu-smart-3-runtime-evidence.md";
const ARCHITECTURE = "docs/architecture/smart-menu-language-profile-currency.md";
const SMART3_MERGE_SHA = "dbf3dc41d8bf6fc28df123336feb0f5e2761c0c1";

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

describe("SMART-3 — runtime evidence housekeeping", () => {
  test("evidence document exists and references SMART-3 merge SHA", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(new RegExp(SMART3_MERGE_SHA));
    expect(doc).toMatch(/PR #395/);
  });

  test("evidence documents production PASS and staging status", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/Production.*PASS|PASS.*Production/i);
    expect(doc).toMatch(/staging\.app\.lunchportalen\.no/i);
    expect(doc).toMatch(/5ce7d51f|behind.*main|DEPLOYMENT_MISSING|NOT RUN/i);
  });

  test("evidence states display-only and provider approval invariants", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/display-only|display only/i);
    expect(doc).toMatch(/provider approval required|Provider approval required/i);
    expect(doc).toMatch(/fallback.*original|Falls back to provider original/i);
    expect(doc).toMatch(/hash mismatch|stale/i);
    expect(doc).toMatch(/does not change menu profile|menu profile, currency/i);
    expect(doc).toMatch(/order identity/i);
  });

  test("evidence states no commercial exposure and no flags/cutover", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/No price|no price|price \/ currency/i);
    expect(doc).toMatch(/LP_MENU_PROFILE_/);
    expect(doc).toMatch(/G5d\.8.*NOT STARTED|NOT STARTED.*G5d\.8/i);
    expect(doc).toMatch(/cutover/i);
    expect(doc).toMatch(/PR #389.*OPEN|OPEN.*PR #389/i);
  });

  test("evidence does not claim SMART-4, AI, source extraction, or currency resolver live", () => {
    const doc = read(EVIDENCE);
    expect(doc).not.toMatch(/SMART-4 is live/i);
    expect(doc).not.toMatch(/SMART-4 has started/i);
    expect(doc).not.toMatch(/SMART-4 is complete/i);
    expect(doc).not.toMatch(/AI translation is live/i);
    expect(doc).not.toMatch(/source extraction is live/i);
    expect(doc).not.toMatch(/currency resolver is live/i);
    expect(doc).toMatch(/PR #389.*OPEN|OPEN.*PR #389/i);
    expect(doc).toMatch(/not merged/i);
  });

  test("evidence contains no secrets", () => {
    const doc = read(EVIDENCE);
    for (const pattern of SECRET_PATTERNS) {
      expect(doc, `evidence must not match ${pattern}`).not.toMatch(pattern);
    }
  });

  test("architecture doc links to SMART-3 runtime evidence", () => {
    const doc = read(ARCHITECTURE);
    expect(doc).toMatch(/smart-menu-smart-3-runtime-evidence\.md/);
  });
});
