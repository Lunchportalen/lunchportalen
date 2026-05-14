import { describe, expect, test } from "vitest";

import { isMissingRelationError } from "@/lib/db/missingRelation";

describe("isMissingRelationError", () => {
  test("42P01 uten tekst trigger (Postgres udefinert tabell-kode)", () => {
    expect(isMissingRelationError({ code: "42P01", message: "x" }, "company_billing_accounts")).toBe(true);
  });

  test("PGRST205 trigger uavhengig av tabellnavn (schema cache)", () => {
    expect(
      isMissingRelationError(
        { code: "PGRST205", message: "Could not find the table 'public.company_billing_accounts' in the schema cache" },
        "company_billing_accounts",
      ),
    ).toBe(true);
  });

  test("tekstlig relation does not exist for målrelasjon", () => {
    expect(
      isMissingRelationError(
        { code: "XX000", message: 'relation "public.company_billing_accounts" does not exist' },
        "company_billing_accounts",
      ),
    ).toBe(true);
  });

  test("ukjent feil → false", () => {
    expect(isMissingRelationError({ code: "UNKNOWN", message: "timeout" }, "company_billing_accounts")).toBe(false);
  });
});
