import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { MenuProfileId } from "@/lib/menu-profile/types";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260727120000_provider_menu_profile_runtime_mapping_drafts.sql",
);

const TABLE = "provider_menu_profile_runtime_mapping_drafts";

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

const FORBIDDEN_RUNTIME_PATTERNS = [
  /lp_order_set/,
  /menuDayPayload/,
  /syncMenuServiceDayItems/,
  /menu_service_day/,
  /from\s+public\.orders/,
];

const REQUIRED_COLUMNS = [
  "id",
  "provider_id",
  "menu_profile_id",
  "mapping_version",
  "source_profile_version",
  "draft_status",
  "mapping_json",
  "unmapped_categories_json",
  "warm_dish_preview_json",
  "validation_summary_json",
  "notes",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "archived_at",
];

describe("G5d.3b — provider_menu_profile_runtime_mapping_drafts migration", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("creates provider_menu_profile_runtime_mapping_drafts table", () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.provider_menu_profile_runtime_mapping_drafts/i,
    );
  });

  it("defines required columns", () => {
    for (const column of REQUIRED_COLUMNS) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("references organizations spine for provider_id", () => {
    expect(sql).toMatch(/provider_id uuid NOT NULL REFERENCES public\.organizations \(id\)/i);
  });

  it("references auth.users for created_by and updated_by", () => {
    expect(sql).toMatch(/created_by uuid NOT NULL REFERENCES auth\.users \(id\)/i);
    expect(sql).toMatch(/updated_by uuid NOT NULL REFERENCES auth\.users \(id\)/i);
  });

  it("enforces draft_status check", () => {
    expect(sql).toMatch(/draft_status IN \('draft', 'reviewed', 'archived'\)/);
  });

  it("CHECK constraint includes operational MenuProfileId values", () => {
    for (const id of OPERATIONAL_MENU_PROFILE_IDS) {
      expect(sql).toContain(`'${id}'`);
    }
    expect(OPERATIONAL_MENU_PROFILE_IDS).toHaveLength(9);
  });

  it("enforces JSONB shape constraints", () => {
    expect(sql).toMatch(/jsonb_typeof\(mapping_json\) = 'object'/);
    expect(sql).toMatch(/jsonb_typeof\(unmapped_categories_json\) = 'array'/);
    expect(sql).toMatch(/jsonb_typeof\(warm_dish_preview_json\) = 'array'/);
    expect(sql).toMatch(/jsonb_typeof\(validation_summary_json\) = 'object'/);
  });

  it("enforces archived_at consistency with draft_status", () => {
    expect(sql).toMatch(/draft_status = 'archived' AND archived_at IS NOT NULL/);
    expect(sql).toMatch(/draft_status <> 'archived' AND archived_at IS NULL/);
  });

  it("creates provider and status indexes including active partial index", () => {
    expect(sql).toMatch(/provider_menu_profile_runtime_mapping_drafts_provider_id_idx/i);
    expect(sql).toMatch(/provider_menu_profile_runtime_mapping_drafts_provider_profile_idx/i);
    expect(sql).toMatch(/provider_menu_profile_runtime_mapping_drafts_provider_status_idx/i);
    expect(sql).toMatch(/provider_menu_profile_runtime_mapping_drafts_updated_at_idx/i);
    expect(sql).toMatch(/provider_menu_profile_runtime_mapping_drafts_active_idx/i);
    expect(sql).toMatch(/WHERE draft_status <> 'archived'/);
  });

  it("enables RLS and defines provider-scoped policies", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toContain(`${TABLE}_service_role_all`);
    expect(sql).toContain(`${TABLE}_superadmin_all`);
    expect(sql).toContain(`${TABLE}_select_provider_scope`);
    expect(sql).toContain(`${TABLE}_insert_provider_admin`);
    expect(sql).toContain(`${TABLE}_update_provider_admin`);
    expect(sql).toMatch(/can_access_provider\(provider_id\)/);
    expect(sql).toMatch(/provider_admin'::public\.provider_role/);
    expect(sql).toMatch(/created_by = auth\.uid\(\)/);
    expect(sql).toMatch(/updated_by = auth\.uid\(\)/);
  });

  it("does not grant DELETE to authenticated and revokes anon", () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.provider_menu_profile_runtime_mapping_drafts FROM PUBLIC, anon/i);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE ON TABLE public\.provider_menu_profile_runtime_mapping_drafts TO authenticated/i);
    expect(sql).not.toMatch(/GRANT DELETE ON TABLE public\.provider_menu_profile_runtime_mapping_drafts TO authenticated/i);
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]*FOR DELETE[\s\S]*TO authenticated/i);
  });

  it("uses updated_at trigger when helper exists", () => {
    expect(sql).toMatch(/provider_menu_profile_runtime_mapping_drafts_set_updated_at/i);
    expect(sql).toMatch(/tg_set_updated_at\(\)/);
  });

  it("does not wire runtime order/publish/Sanity relations", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(sql, `migration must not reference ${pattern}`).not.toMatch(pattern);
    }
    expect(sql).not.toMatch(/can_publish|can_order|can_save/i);
  });

  it("documents metadata-only scope in comments", () => {
    expect(sql).toMatch(/staging-only|metadata|snapshot/i);
    expect(sql).toMatch(/Not read by publish\/order\/week\/Sanity runtime/i);
  });
});
