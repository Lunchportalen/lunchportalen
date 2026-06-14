import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const PAGE_PATH = join(process.cwd(), "app", "admin", "page.tsx");

describe("app/admin/page", () => {
  test("beholder eksisterende admin-loadere", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("loadAdminContext");
    expect(source).toContain("loadCompanyOperationalBrief");
  });

  test("renderer enterprise command center-seksjoner", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("<CommandCenterHero");
    expect(source).toContain("<OnboardingActionPanel");
    expect(source).toContain("<ReadinessStrip");
    expect(source).toContain("<OrdersChart");
    expect(source).toContain("<ActivityFeed");
    expect(source).toContain("<TodayRoster");
    expect(source).toContain("<SystemStatus");
  });

  test("skjuler KPI-rad i onboarding-modus", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("{!onboarding ? <KpiRow");
  });

  test("bruker dashboard command center helper", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("buildReadinessStrip");
    expect(source).toContain("isOnboardingMode");
    expect(source).not.toContain("ledger_pipeline_label_nb");
  });

  test("fjerner gamle Oversikt-bokser", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).not.toContain("CompanyOperationalBriefPanel");
    expect(source).not.toContain("CommandCenterKpis");
    expect(source).not.toContain("Quick links");
  });
});
