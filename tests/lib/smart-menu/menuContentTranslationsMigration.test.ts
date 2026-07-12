import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
import {
  MENU_CONTENT_FIELDS,
  MENU_CONTENT_SOURCE_KINDS,
  MENU_CONTENT_TRANSLATION_STATUSES,
} from "@/lib/smart-menu/translationStatus";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260728120000_menu_content_translations.sql",
);

const TABLE = "menu_content_translations";

const FORBIDDEN_RUNTIME_PATTERNS = [
  /lp_order_set/,
  /menuDayPayload/,
  /syncMenuServiceDayItems/,
  /from\s+public\.orders/,
  /app\/api\/week/,
];

const REQUIRED_COLUMNS = [
  "id",
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
  "created_at",
  "updated_at",
] as const;

describe("SMART-1 — menu_content_translations migration", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("creates menu_content_translations table", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.menu_content_translations/i);
  });

  it("defines required columns", () => {
    for (const column of REQUIRED_COLUMNS) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("references organizations spine for provider_id", () => {
    expect(sql).toMatch(/provider_id uuid NOT NULL REFERENCES public\.organizations \(id\)/i);
  });

  it("references auth.users for approved_by", () => {
    expect(sql).toMatch(/approved_by uuid NULL REFERENCES auth\.users \(id\)/i);
  });

  it("enforces unique provider/source/field/locale constraint", () => {
    expect(sql).toMatch(
      /UNIQUE \(provider_id, source_kind, source_ref, field, locale\)/i,
    );
  });

  it("CHECK constraint includes all source_kind values", () => {
    for (const kind of MENU_CONTENT_SOURCE_KINDS) {
      expect(sql).toContain(`'${kind}'`);
    }
  });

  it("CHECK constraint includes all field values", () => {
    for (const field of MENU_CONTENT_FIELDS) {
      expect(sql).toContain(`'${field}'`);
    }
  });

  it("CHECK constraint includes all status values", () => {
    for (const status of MENU_CONTENT_TRANSLATION_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it("locale CHECK aligns with APP_LOCALES registry (additive migration chain)", () => {
    // Original migration covers the nine base locales.
    const originalNine = ["nb", "en", "sv", "da", "fi", "de", "fr", "es", "it"];
    for (const locale of originalNine) {
      expect(sql).toContain(`'${locale}'`);
    }
    // Dutch additive migration widened to ten.
    const dutchSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260816120000_menu_content_translations_add_dutch.sql"),
      "utf8",
    );
    for (const locale of [...originalNine, "nl"]) {
      expect(dutchSql).toContain(`'${locale}'`);
    }
    // 21-country correction migration owns the current CHECK: all fifteen base languages.
    const correctionSql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260817120000_21_country_market_correction.sql"),
      "utf8",
    );
    for (const locale of APP_LOCALES) {
      expect(correctionSql).toContain(`'${locale}'`);
    }
    expect(APP_LOCALES).toHaveLength(15);
  });

  it("creates provider, locale/status, source_ref, and approved partial indexes", () => {
    expect(sql).toMatch(/menu_content_translations_provider_id_idx/i);
    expect(sql).toMatch(/menu_content_translations_provider_locale_status_idx/i);
    expect(sql).toMatch(/menu_content_translations_provider_source_ref_idx/i);
    expect(sql).toMatch(/menu_content_translations_approved_lookup_idx/i);
    expect(sql).toMatch(/WHERE status = 'approved'/i);
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
  });

  it("does not grant DELETE to authenticated and revokes anon", () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.menu_content_translations FROM PUBLIC, anon/i);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE ON TABLE public\.menu_content_translations TO authenticated/i);
    expect(sql).not.toMatch(/GRANT DELETE ON TABLE public\.menu_content_translations TO authenticated/i);
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]*FOR DELETE[\s\S]*TO authenticated/i);
  });

  it("uses updated_at trigger when helper exists", () => {
    expect(sql).toMatch(/menu_content_translations_set_updated_at/i);
    expect(sql).toMatch(/tg_set_updated_at\(\)/);
  });

  it("does not wire runtime order/publish/week/Sanity relations", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(sql, `migration must not reference ${pattern}`).not.toMatch(pattern);
    }
  });

  it("documents storage-only scope in comments", () => {
    expect(sql).toMatch(/SMART-1|Not read by employee runtime/i);
    expect(sql).toMatch(/future SMART-3 server read model/i);
  });
});
