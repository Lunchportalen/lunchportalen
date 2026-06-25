import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const EXPECTED_PROFILE_LOCALES = ["nb", "en", "sv", "da", "fi", "de", "fr", "es", "it"] as const;

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260726120000_profiles_preferred_locale_nine_locales.sql",
);

describe("profiles.preferred_locale migration", () => {
  it("extends CHECK constraint to all nine app locales", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check");
    expect(sql).toContain("ADD CONSTRAINT profiles_preferred_locale_check");
    for (const locale of EXPECTED_PROFILE_LOCALES) {
      expect(sql).toContain(`'${locale}'`);
    }
  });
});
