import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const PEOPLE_CLIENT = join(process.cwd(), "app", "admin", "people", "PeopleClient.tsx");
const EMPLOYEES_TABLE = join(process.cwd(), "components", "admin", "EmployeesTable.tsx");

function readSource(path: string) {
  return readFileSync(path, "utf-8");
}

function visibleSource(source: string) {
  return source
    .replace(/<AdminTechnicalDetails[\s\S]*?\/>/g, "")
    .replace(/<AdminTechnicalDetails[\s\S]*?<\/AdminTechnicalDetails>/g, "")
    .replace(/<details[\s\S]*?<\/details>/g, "")
    .replace(/\{[^}]+\}/g, "");
}

describe("/admin/people page hierarchy", () => {
  test("PeopleClient exposes one primary Inviter ansatt CTA in header actions", () => {
    const source = readSource(PEOPLE_CLIENT);
    const headerActions = source.match(/actions=\{[\s\S]*?\}\s*>/)?.[0] ?? "";
    const primaryMatches = headerActions.match(/Inviter ansatt/g) ?? [];
    expect(primaryMatches.length).toBe(1);
    expect(source).toContain('href="/admin/invite"');
  });

  test("EmployeesTable hides heavy toolbar invite actions when showToolbarActions is false", () => {
    const people = readSource(PEOPLE_CLIENT);
    expect(people).toContain("showToolbarActions={false}");
    expect(people).toContain("canInvite={false}");

    const table = readSource(EMPLOYEES_TABLE);
    expect(table).toContain("showToolbarActions");
    expect(table).toMatch(/showLegacyToolbar\s*=\s*showToolbarActions/);
  });

  test("only one search input lives in PeopleClient list section", () => {
    const source = readSource(PEOPLE_CLIENT);
    const searchInputs = source.match(/placeholder="Søk navn/g) ?? [];
    expect(searchInputs.length).toBe(1);
    expect(source).not.toContain('method="get"');
    expect(source).toContain("searchQuery={searchQuery}");
  });

  test("Ansattliste title and company-scoped copy are visible", () => {
    const source = readSource(PEOPLE_CLIENT);
    expect(source).toContain("PEOPLE_LIST_TITLE");
    expect(source).toContain("peopleListScopeNote");
    expect(source).toContain("PEOPLE_READINESS_NEXT_INVITE");
    expect(source).toContain("PEOPLE_READINESS_HAS_EMPLOYEES");
  });

  test("main table does not show raw UUID columns or user_id", () => {
    const table = readSource(EMPLOYEES_TABLE);
    const visible = visibleSource(table);
    expect(visible).not.toMatch(/<th[^>]*>\s*user_id\s*<\/th>/i);
    expect(visible).not.toMatch(/\{r\.user_id\}/);
    expect(table).toContain("formatLocationLabel");
  });

  test("location uses readable label helper", () => {
    const table = readSource(EMPLOYEES_TABLE);
    expect(table).toContain("locationLabels[locationId]");
    expect(table).toContain("Ikke satt");
  });

  test("technical info is collapsed by default via AdminTechnicalDetails", () => {
    const source = readSource(PEOPLE_CLIENT);
    expect(source).toContain("<AdminTechnicalDetails");
    expect(source).toContain("TECHNICAL_DETAILS_SUMMARY");
    expect(source).not.toMatch(/company_id[\s\S]{0,80}<\/p>/);
  });

  test("duplicate Oversikt and stat grid removed from PeopleClient", () => {
    const source = readSource(PEOPLE_CLIENT);
    expect(source).not.toContain("Oversikt");
    expect(source).not.toMatch(/StatItem/);
    expect(source).not.toMatch(/Viser/);
  });

  test("surface files stay UI-only without auth or schema changes", () => {
    for (const file of [PEOPLE_CLIENT, EMPLOYEES_TABLE]) {
      const source = readSource(file);
      expect(source).not.toMatch(/supabase\/migrations/);
      expect(source).not.toMatch(/lp_order_set/);
      expect(source).not.toMatch(/createClient/);
    }
  });
});
