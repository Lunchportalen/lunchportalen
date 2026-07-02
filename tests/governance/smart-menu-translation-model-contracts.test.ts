/**
 * SMART-1 — translation data model + RLS governance contracts (static).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  isMenuProfileCompatibilityCutoverEnabled,
  isMenuProfileResolverEnabled,
  isMenuProfileRuntimeCompatibilityHookEnabled,
} from "@/lib/menu-profile/featureFlag";
import {
  EMPLOYEE_VISIBLE_TRANSLATION_STATUS,
  isEmployeeVisibleTranslation,
  isNonEmployeeVisibleStatus,
  MENU_CONTENT_TRANSLATION_STATUSES,
} from "@/lib/smart-menu/translationStatus";

const ROOT = process.cwd();
const MIGRATION = "supabase/migrations/20260728120000_menu_content_translations.sql";
const DESIGN_DOC = "docs/architecture/smart-menu-language-profile-currency.md";
const TABLE = "menu_content_translations";

const FORBIDDEN_RUNTIME_PATHS = [
  "app/(app)/week/EmployeeWeekClient.tsx",
  "app/api/order/window/route.ts",
  "app/api/week/route.ts",
  "app/api/orders/route.ts",
  "lib/orders/orderWriteGuard.ts",
  "lib/orders/resolveOrderDayItemPersist.ts",
  "lib/menu-publish/tierPricing.ts",
  "lib/provider-menu/menuDayPayload.ts",
] as const;

const SECRET_PATTERNS = [
  /password\s*=\s*[^\s\n]+/i,
  /access_token\s*=\s*[^\s\n]+/i,
  /refresh_token\s*=\s*[^\s\n]+/i,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
  /service_role\s*=\s*[^\s\n]+/i,
  /postgresql:\/\/[^\s\n]+:[^\s\n]+@/i,
] as const;

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("SMART-1 — migration/table contract", () => {
  test("migration file exists", () => {
    expect(fs.existsSync(path.join(ROOT, MIGRATION))).toBe(true);
  });

  test("migration defines menu_content_translations with required columns", () => {
    const sql = readSource(MIGRATION);
    for (const column of [
      "provider_id",
      "source_kind",
      "source_ref",
      "field",
      "locale",
      "original_text",
      "original_text_hash",
      "translated_text",
      "status",
      "approved_by",
      "approved_at",
    ]) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  test("migration enforces unique and CHECK constraints", () => {
    const sql = readSource(MIGRATION);
    expect(sql).toMatch(/UNIQUE \(provider_id, source_kind, source_ref, field, locale\)/i);
    expect(sql).toMatch(/source_kind IN \('menu_day', 'menu_day_item', 'category_label', 'allergen_label'\)/);
    expect(sql).toMatch(/field IN \('title', 'description', 'label'\)/);
    expect(sql).toMatch(/status IN \('missing', 'draft', 'suggested', 'approved', 'rejected', 'stale'\)/);
  });

  test("migration includes approved lookup partial index", () => {
    const sql = readSource(MIGRATION);
    expect(sql).toMatch(/menu_content_translations_approved_lookup_idx/i);
    expect(sql).toMatch(/WHERE status = 'approved'/i);
  });
});

describe("SMART-1 — RLS contract", () => {
  test("RLS enabled with provider-scoped policies; no authenticated DELETE", () => {
    const sql = readSource(MIGRATION);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toContain(`${TABLE}_select_provider_scope`);
    expect(sql).toContain(`${TABLE}_insert_provider_admin`);
    expect(sql).toContain(`${TABLE}_update_provider_admin`);
    expect(sql).toMatch(/can_access_provider\(provider_id\)/);
    expect(sql).not.toMatch(/GRANT DELETE ON TABLE public\.menu_content_translations TO authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.menu_content_translations FROM PUBLIC, anon/i);
  });

  test("no policy grants all authenticated users global read", () => {
    const sql = readSource(MIGRATION);
    expect(sql).not.toMatch(/FOR SELECT[\s\S]*TO authenticated[\s\S]*USING \(true\)/i);
  });
});

describe("SMART-1 — employee visibility contract", () => {
  test("only approved status is employee-visible when hash matches", () => {
    expect(EMPLOYEE_VISIBLE_TRANSLATION_STATUS).toBe("approved");
    expect(isEmployeeVisibleTranslation("approved", true)).toBe(true);
    expect(isEmployeeVisibleTranslation("approved", false)).toBe(false);
  });

  test("draft/suggested/rejected/stale/missing are not employee-visible", () => {
    for (const status of ["draft", "suggested", "rejected", "stale", "missing"] as const) {
      expect(isNonEmployeeVisibleStatus(status)).toBe(true);
      expect(isEmployeeVisibleTranslation(status, true)).toBe(false);
    }
  });

  test("stale hash mismatch is not employee-visible even if status was approved historically", () => {
    expect(isEmployeeVisibleTranslation("approved", false)).toBe(false);
    expect(isNonEmployeeVisibleStatus("stale")).toBe(true);
  });

  test("design doc requires original provider text fallback until reapproved", () => {
    const doc = readSource(DESIGN_DOC);
    expect(doc).toMatch(/original provider text|Original provider text/i);
    expect(doc).toMatch(/reapproved|reapprove/i);
  });
});

describe("SMART-1 — no runtime integration", () => {
  test("forbidden runtime paths unchanged by SMART-1 (no menu_content_translations wiring)", () => {
    for (const relPath of FORBIDDEN_RUNTIME_PATHS) {
      const src = readSource(relPath);
      expect(src, `${relPath} must not reference menu_content_translations`).not.toMatch(
        /menu_content_translations/,
      );
    }
  });

  test("LP_MENU_PROFILE_* flags remain default OFF", () => {
    expect(isMenuProfileResolverEnabled({})).toBe(false);
    expect(isMenuProfileCompatibilityCutoverEnabled({})).toBe(false);
    expect(isMenuProfileRuntimeCompatibilityHookEnabled({})).toBe(false);
  });
});

describe("SMART-1 — currency/profile separation still holds", () => {
  test("design doc forbids employee locale as currency/profile source", () => {
    const doc = readSource(DESIGN_DOC);
    expect(doc).toMatch(/lp_locale/);
    expect(doc).toMatch(/profiles\.preferred_locale/);
    expect(doc).toMatch(/Must never use|must never use/i);
    expect(doc).toMatch(/employee language cannot change profile|Employee language cannot change profile/i);
  });
});

describe("SMART-1 — PR #389 and doc status", () => {
  test("design doc still marks PR #389 superseded / not merged", () => {
    const doc = readSource(DESIGN_DOC);
    expect(doc).toMatch(/PR #389/);
    expect(doc).toMatch(/superseded|Superseded/i);
    expect(doc).toMatch(/do not merge|Do not merge/i);
  });

  test("design doc documents SMART-1 implementation without live employee translations", () => {
    const doc = readSource(DESIGN_DOC);
    expect(doc).toMatch(/SMART-1/);
    expect(doc).toMatch(/Not read by employee runtime|SMART-1 non-goals|No employee `\/week` overlay/i);
    expect(doc).not.toMatch(/employee translations are live/i);
    expect(doc).not.toMatch(/provider approval UI exists/i);
  });
});

describe("SMART-1 — no secrets in migration/docs/tests", () => {
  test("migration and design doc contain no obvious secrets", () => {
    const migration = readSource(MIGRATION);
    const doc = readSource(DESIGN_DOC);
    for (const pattern of SECRET_PATTERNS) {
      expect(migration).not.toMatch(pattern);
      expect(doc).not.toMatch(pattern);
    }
  });
});

describe("SMART-1 — pure helper module exists without runtime fetch", () => {
  test("translationStatus helper is pure — no Supabase or API imports", () => {
    const src = readSource("lib/smart-menu/translationStatus.ts");
    expect(src).not.toMatch(/@supabase|createClient|fetch\(/);
    expect(src).toContain("isEmployeeVisibleTranslation");
    expect(MENU_CONTENT_TRANSLATION_STATUSES).toHaveLength(6);
  });
});
