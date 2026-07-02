/**
 * SMART-1 housekeeping — static evidence document contract.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const EVIDENCE = "docs/architecture/smart-menu-smart-1-db-evidence.md";
const DATABASE_TYPES = "lib/types/database.ts";
const SMART1_MERGE_SHA = "7eaf0fb35181ddda3a08e244b83084c05b1b8884";

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

describe("SMART-1 — db evidence housekeeping", () => {
  test("evidence document exists and references SMART-1 merge SHA", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(new RegExp(SMART1_MERGE_SHA));
    expect(doc).toMatch(/20260728120000_menu_content_translations\.sql/);
    expect(doc).toMatch(/28614693722/);
    expect(doc).toMatch(/28613352389|28611286137/);
  });

  test("evidence documents staging vs production migrate status", () => {
    const doc = read(EVIDENCE);
    expect(doc).toMatch(/staging/u);
    expect(doc).toMatch(/production/u);
    expect(doc).toMatch(/waiting|pending/i);
    expect(doc).toMatch(/SMART-2.*Not started|not started/i);
  });

  test("evidence contains no secrets", () => {
    const doc = read(EVIDENCE);
    for (const pattern of SECRET_PATTERNS) {
      expect(doc, `evidence must not match ${pattern}`).not.toMatch(pattern);
    }
  });

  test("database types include strict menu_content_translations table", () => {
    const types = read(DATABASE_TYPES);
    expect(types).toMatch(/MenuContentTranslationsTable/);
    expect(types).toMatch(/menu_content_translations/);
    for (const col of [
      "provider_id",
      "source_kind",
      "source_ref",
      "original_text_hash",
      "translated_text",
      "approved_by",
      "approved_at",
    ]) {
      expect(types, `missing column ${col}`).toMatch(new RegExp(col));
    }
  });
});
