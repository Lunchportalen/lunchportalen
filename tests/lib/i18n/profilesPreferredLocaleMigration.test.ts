import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const NINE_LOCALES = ["nb", "en", "sv", "da", "fi", "de", "fr", "es", "it"] as const;
const EXPECTED_PROFILE_LOCALES = [...NINE_LOCALES, "nl"] as const;

const NINE_LOCALE_MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260726120000_profiles_preferred_locale_nine_locales.sql",
);
const DUTCH_MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260815120000_profiles_preferred_locale_add_dutch.sql",
);

describe("profiles.preferred_locale migration", () => {
  it("nine-locale migration extends CHECK constraint to the original nine app locales", () => {
    const sql = readFileSync(NINE_LOCALE_MIGRATION, "utf8");
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check");
    expect(sql).toContain("ADD CONSTRAINT profiles_preferred_locale_check");
    for (const locale of NINE_LOCALES) {
      expect(sql).toContain(`'${locale}'`);
    }
  });

  it("additive Dutch migration extends the CHECK constraint to all ten app locales", () => {
    const sql = readFileSync(DUTCH_MIGRATION, "utf8");
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check");
    expect(sql).toContain("ADD CONSTRAINT profiles_preferred_locale_check");
    for (const locale of EXPECTED_PROFILE_LOCALES) {
      expect(sql).toContain(`'${locale}'`);
    }
  });
});
