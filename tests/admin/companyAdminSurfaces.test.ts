import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const ADMIN_ROOT = join(process.cwd(), "app", "admin");
const COMPONENTS_ADMIN = join(process.cwd(), "components", "admin");

const SURFACE_FILES = [
  join(ADMIN_ROOT, "people", "PeopleClient.tsx"),
  join(ADMIN_ROOT, "locations", "page.tsx"),
  join(COMPONENTS_ADMIN, "LocationsPanel.tsx"),
  join(ADMIN_ROOT, "agreement", "page.tsx"),
  join(ADMIN_ROOT, "uke-bestillbarhet", "page.tsx"),
  join(ADMIN_ROOT, "insights", "AdminInsightsClient.tsx"),
  join(ADMIN_ROOT, "insights", "page.tsx"),
  join(COMPONENTS_ADMIN, "CompanyOperationalBriefPanel.tsx"),
  join(COMPONENTS_ADMIN, "AgreementDeliveryBasisView.tsx"),
  join(COMPONENTS_ADMIN, "EmployeesTable.tsx"),
];

const FORBIDDEN_VISIBLE = [
  /\bledger\b/i,
  /\bdaymap\b/i,
  /operativ modell/i,
  /Kilde til sannhet/i,
  /tenant-sikker/i,
  /Send systemrapport/,
];

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

describe("company admin surfaces — enterprise copy", () => {
  test("target files exist", () => {
    for (const file of SURFACE_FILES) {
      expect(readSource(file).length).toBeGreaterThan(0);
    }
  });

  for (const term of FORBIDDEN_VISIBLE) {
    test(`no visible user-facing match: ${term}`, () => {
      for (const file of SURFACE_FILES) {
        const source = visibleSource(readSource(file));
        expect(source).not.toMatch(term);
      }
    });
  }

  test("/admin/people drives employee onboarding CTA", () => {
    const source = readSource(join(ADMIN_ROOT, "people", "PeopleClient.tsx"));
    expect(source).toContain("Inviter ansatt");
    expect(source).toContain("Inviter via e-postliste");
    expect(source).toContain("Last ned CSV");
    expect(source).toContain("PEOPLE_READINESS_EMPTY_TITLE");
    expect(source).toContain("PEOPLE_LIST_TITLE");
    expect(source).toContain("showToolbarActions={false}");
    expect(source).toContain("PEOPLE_READINESS_PENDING_TITLE");
    expect(source).toContain("PEOPLE_READINESS_ACTIVE_CTA");
  });

  test("/admin/locations hides raw location UUID by default", () => {
    const source = readSource(join(COMPONENTS_ADMIN, "LocationsPanel.tsx"));
    expect(source).not.toMatch(/ID:\s*<span className="font-mono">\{loc\.id\}/);
    expect(source).toMatch(/<summary[^>]*>Vis teknisk info<\/summary>/);
  });

  test("/admin/agreement shows business-readable summary", () => {
    const source = readSource(join(ADMIN_ROOT, "agreement", "page.tsx"));
    expect(source).toContain("Avtale og drift");
    expect(source).toContain("Dette er avtalen som styrer meny, leveringsdager og bestilling");
    expect(source).toContain("Ønsker dere endring?");
    expect(source).toContain("AGREEMENT_CHANGE_NOTE");
  });

  test("/admin/uke-bestillbarhet explains orderable days", () => {
    const source = readSource(join(ADMIN_ROOT, "uke-bestillbarhet", "page.tsx"));
    expect(source).toContain("UKE_BESTILLBARHET_SUBTITLE");
    expect(source).toContain("bookabilityDayStatus");
    expect(source).toContain("Åpen for bestilling");
  });

  test("/admin/insights has trustworthy empty-state copy", () => {
    const source = readSource(join(ADMIN_ROOT, "insights", "AdminInsightsClient.tsx"));
    expect(source).toContain("INSIGHTS_EMPTY_TITLE");
    expect(source).toContain("Forbruksinnsikt");
    expect(source).not.toMatch(/AI Innsikt/);
  });

  test("technical IDs use Vis teknisk info pattern", () => {
    const people = readSource(join(ADMIN_ROOT, "people", "PeopleClient.tsx"));
    expect(people).toContain("AdminTechnicalDetails");
    expect(people).toContain("TECHNICAL_DETAILS_SUMMARY");

    const agreement = readSource(join(ADMIN_ROOT, "agreement", "page.tsx"));
    expect(agreement).toContain("AdminTechnicalDetails");
    expect(visibleSource(agreement)).not.toContain("Firma-ID:");
  });

  test("snapshot only appears in hidden technical details", () => {
    for (const file of SURFACE_FILES) {
      const source = readSource(file);
      if (!/\bsnapshot\b/i.test(source)) continue;
      expect(source).toMatch(/AdminTechnicalDetails|<details|company_current_agreement/);
    }
  });
});

describe("company admin surfaces — scope guard", () => {
  test("surface files stay in admin UI layer", () => {
    expect(SURFACE_FILES.every((f) => f.includes("admin") || f.includes("components"))).toBe(true);
  });

  test("no schema migration files in surface list", () => {
    for (const file of SURFACE_FILES) {
      expect(file).not.toContain("supabase");
    }
  });
});
