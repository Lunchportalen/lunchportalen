import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { MenuProfileId } from "@/lib/menu-profile/types";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260725120000_provider_settings_menu_profile_id.sql",
);

const FORBIDDEN_RUNTIME_PATTERNS = [
  /from\s+["']@\/app/,
  /from\s+["']@\/components/,
  /app\/api/,
  /lp_order_set/,
  /menuDayPayload/,
  /pricePreview/,
];

const OPERATIONAL_MENU_PROFILE_IDS: readonly MenuProfileId[] = [
  "norwegian_company_lunch",
  "swedish_lunch",
  "danish_office_lunch",
  "finnish_office_lunch",
  "german_business_lunch",
  "french_dejeuner",
  "spanish_menu_del_dia",
  "uk_office_lunch",
  "italian_office_lunch",
];

describe("provider_settings.menu_profile_id migration (ADR-019 G2)", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("migration file exists and adds menu_profile_id to provider_settings", () => {
    expect(sql).toContain("ALTER TABLE public.provider_settings");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS menu_profile_id/i);
  });

  it("allows null menu_profile_id", () => {
    expect(sql).toContain("menu_profile_id IS NULL");
    expect(sql).not.toMatch(/menu_profile_id\s+text\s+NOT NULL/i);
  });

  it("CHECK constraint includes operational MenuProfileId values", () => {
    expect(sql).toContain("provider_settings_menu_profile_id_check");
    for (const id of OPERATIONAL_MENU_PROFILE_IDS) {
      expect(sql).toContain(`'${id}'`);
    }
    expect(OPERATIONAL_MENU_PROFILE_IDS).toHaveLength(9);
  });

  it("is idempotent (guarded column add and constraint replace)", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS menu_profile_id/i);
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS provider_settings_menu_profile_id_check");
  });

  it("documents rollback and leaves RLS unchanged", () => {
    expect(sql).toMatch(/RLS:\s*intentionally unchanged/i);
    expect(sql).toMatch(/Rollback/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });

  it("does not backfill existing rows", () => {
    expect(sql).not.toMatch(/^\s*UPDATE\s+public\.provider_settings/im);
  });

  it("does not mention app/runtime wiring", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(sql, `migration must not reference ${pattern}`).not.toMatch(pattern);
    }
  });
});
