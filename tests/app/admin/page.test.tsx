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

  test("renderer nye Phase 1-seksjoner", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("<KpiRow data={kpiData} />");
    expect(source).toContain("<OrdersChart data={chartData} />");
    expect(source).toContain("<ActivityFeed items={activityItems} />");
    expect(source).toContain("<TodayRoster items={rosterItems} />");
    expect(source).toContain("<SystemStatus data={systemStatus} />");
  });

  test("bruker getAgreementStatus for systemstatus", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("getAgreementStatus");
    expect(source).toContain("agreementStatus.billingHold");
  });

  test("fjerner gamle Oversikt-bokser", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).not.toContain("CompanyOperationalBriefPanel");
    expect(source).not.toContain("CommandCenterKpis");
    expect(source).not.toContain("Quick links");
  });
});
