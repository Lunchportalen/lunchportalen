import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import type { AgreementStatusResult } from "@/lib/auth/agreementStatus";
import type { CompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";
import {
  assertNoForbiddenDashboardCopy,
  buildDashboardActivity,
  buildDashboardKpis,
  buildDashboardRoster,
  buildDashboardSystemStatus,
  buildHeroHeading,
  buildOnboardingChecklist,
  buildReadinessStrip,
  formatDashboardBillingLabel,
  formatDeliveryDaysLabel,
  isOnboardingMode,
  resolveChartEmptyVariant,
} from "@/lib/admin/dashboardOnboarding";

function agreement(overrides: Partial<AgreementStatusResult> = {}): AgreementStatusResult {
  return {
    agreementId: "ag_1",
    tier: "BASIS",
    dayTiers: {
      mon: "BASIS",
      tue: "BASIS",
      wed: "BASIS",
      thu: "BASIS",
      fri: "BASIS",
    },
    status: "ACTIVE",
    isActive: true,
    billingHold: false,
    ...overrides,
  };
}

function brief(overrides: Partial<CompanyOperationalBrief> = {}): CompanyOperationalBrief {
  return {
    today_iso: "2026-06-13",
    company_status_upper: "ACTIVE",
    ledger_active_id: "ledger_1",
    ledger_pending_id: null,
    ledger_pipeline_label_nb: "Aktiv ledger-avtale",
    snapshot_agreement_status_upper: "ACTIVE",
    operative_day_keys: ["mon", "tue", "wed", "thu", "fri"],
    operative_days_label_nb: "mandag, tirsdag, onsdag, torsdag, fredag",
    week_visibility_summary_nb: "Uke synlig",
    cutoff_today: "TODAY_OPEN",
    today_weekday_key: "fri",
    is_weekend_today: false,
    closed_today_reason: null,
    booking_today: "open",
    booking_detail_lines_nb: ["Operativt åpent for bestilling i dag etter modell."],
    orders_day: {
      ok: true,
      total_operative: 0,
      total_raw_active: 0,
      missing_scope_excluded: 0,
      cancelled_day_choice_excluded: 0,
      by_slot: {},
      by_location: [],
      order_notes_nonempty: 0,
      day_choice_notes_nonempty: 0,
    },
    orders_context_lines_nb: [],
    ledger_delivery_window_nb: "11:00–12:00",
    ...overrides,
  };
}

function input(
  overrides: {
    employeesActive?: number;
    ordersWeekActive?: number;
    orderCountToday?: number;
    providerName?: string | null;
    ehfEnabled?: boolean;
    brief?: Partial<CompanyOperationalBrief>;
  } = {},
) {
  return {
    companyName: "Pettersen&Co",
    providerName: overrides.providerName ?? "Melhus Catering",
    ehfEnabled: overrides.ehfEnabled ?? true,
    employeesActive: overrides.employeesActive ?? 0,
    employeesTotal: overrides.employeesActive ?? 0,
    ordersTodayActive: overrides.orderCountToday ?? 0,
    ordersWeekActive: overrides.ordersWeekActive ?? 0,
    orderCountToday: overrides.orderCountToday ?? 0,
    agreementStatus: agreement(),
    operationalBrief: brief(overrides.brief),
  };
}

describe("dashboard command center read-model", () => {
  test("new company with 0 employees is onboarding mode", () => {
    expect(isOnboardingMode(0)).toBe(true);
    expect(isOnboardingMode(3)).toBe(false);
  });

  test("onboarding hero heading uses company name", () => {
    expect(buildHeroHeading("Pettersen&Co", true)).toBe("Pettersen&Co er klar for firmalunsj");
    expect(buildHeroHeading("", true)).toBe("Bedriften er klar for firmalunsj");
  });

  test("onboarding KPIs explain zero and omit adoption", () => {
    const kpis = buildDashboardKpis(input());
    expect(kpis.map((k) => k.label)).toEqual(["Ansatte", "Bestilling", "Denne uken", "Neste levering"]);
    expect(kpis.find((k) => k.label === "Adopsjon")).toBeUndefined();
    expect(kpis[1].value).toBe("Venter");
    expect(kpis[1].foot).toBe("Venter på ansatte");
    expect(kpis[0].ctaLabel).toBe("Inviter ansatte");
  });

  test("operational KPIs include adoption when employees exist", () => {
    const kpis = buildDashboardKpis(input({ employeesActive: 10, orderCountToday: 4, ordersWeekActive: 12 }));
    expect(kpis.map((k) => k.label)).toContain("Adopsjon");
    expect(kpis.find((k) => k.label === "Adopsjon")?.value).toBe("40%");
  });

  test("readiness strip shows provider and first order state", () => {
    const items = buildReadinessStrip(input());
    expect(items.find((item) => item.label === "Avtale")?.value).toBe("Basis · Aktiv");
    expect(items.find((item) => item.label === "Leverandør")?.value).toBe("Melhus Catering");
    expect(items.find((item) => item.label === "Leveringsdager")?.value).toBe("Mandag–fredag");
    expect(items.find((item) => item.label === "Første ordre")?.value).toBe("Venter på ansatte");
  });

  test("activity feed for onboarding has no forbidden copy", () => {
    const items = buildDashboardActivity(input());
    const combined = items.map((item) => `${item.text} ${item.time}`).join(" ");
    expect(assertNoForbiddenDashboardCopy(combined)).toBe(true);
    expect(combined).toContain("Pettersen&Co");
    expect(combined).toContain("Melhus Catering");
    expect(combined).toContain("Første uke overvåkes manuelt");
  });

  test("weekend activity uses friendly copy", () => {
    const items = buildDashboardActivity(
      input({
        employeesActive: 5,
        brief: { is_weekend_today: true, booking_today: "not_applicable" },
      }),
    );
    const combined = items.map((item) => `${item.text} ${item.time}`).join(" ");
    expect(combined).toContain("Neste leveringsdag vises basert på avtalen");
    expect(assertNoForbiddenDashboardCopy(combined)).toBe(true);
  });

  test("system status shows EHF when enabled", () => {
    const rows = buildDashboardSystemStatus(input({ ehfEnabled: true }));
    expect(rows.find((row) => row.label === "Faktura")?.value).toBe("EHF klargjort");
    expect(rows.find((row) => row.label === "Leverandør")?.value).toBe("Melhus Catering");
    expect(rows.find((row) => row.label === "Ansatte")?.value).toBe("0 lagt til");
  });

  test("billing label without EHF is calm for onboarding", () => {
    expect(formatDashboardBillingLabel({ employeesActive: 0, billingHold: false, ehfEnabled: false }).value).toBe(
      "Håndteres etter avtale",
    );
  });

  test("chart empty variants", () => {
    expect(resolveChartEmptyVariant({ employeesActive: 0, ordersWeekActive: 0, orderCountToday: 0 })).toBe(
      "onboarding",
    );
    expect(resolveChartEmptyVariant({ employeesActive: 4, ordersWeekActive: 0, orderCountToday: 0 })).toBe(
      "waiting_orders",
    );
    expect(resolveChartEmptyVariant({ employeesActive: 4, ordersWeekActive: 3, orderCountToday: 1 })).toBe(null);
  });

  test("onboarding checklist has 5 steps with invite current", () => {
    const steps = buildOnboardingChecklist({
      employeesActive: 0,
      ordersWeekActive: 0,
      orderCountToday: 0,
      providerName: "Melhus Catering",
    });
    expect(steps).toHaveLength(5);
    expect(steps[0].state).toBe("completed");
    expect(steps[1].state).toBe("current");
    expect(steps[4].state).toBe("info");
    expect(steps[3].label).toContain("Melhus Catering");
  });

  test("delivery days label formats mon-fri as Mandag–fredag", () => {
    expect(formatDeliveryDaysLabel(["mon", "tue", "wed", "thu", "fri"])).toBe("Mandag–fredag");
  });

  test("onboarding roster explains waiting state without forbidden copy", () => {
    const roster = buildDashboardRoster(input());
    const combined = roster.map((item) => `${item.name} ${item.meta}`).join(" ");
    expect(combined).toContain("Melhus Catering");
    expect(assertNoForbiddenDashboardCopy(combined)).toBe(true);
  });
});

const PAGE_PATH = join(process.cwd(), "app", "admin", "page.tsx");

describe("app/admin/page command center wiring", () => {
  test("uses command center structure without ledger copy", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("CommandCenterHero");
    expect(source).toContain("OnboardingActionPanel");
    expect(source).toContain("ReadinessStrip");
    expect(source).toContain("loadDashboardCompanyMeta");
    expect(source).toContain("emptyVariant={chartEmptyVariant}");
    expect(source).toContain("{!onboarding ? <KpiRow");
    expect(source).not.toContain("ledger_pipeline_label_nb");
    expect(source).not.toContain("OnboardingHero");
  });

  test("keeps existing admin loaders and company scoping", () => {
    const source = readFileSync(PAGE_PATH, "utf-8");
    expect(source).toContain("loadAdminContext");
    expect(source).toContain("loadCompanyOperationalBrief");
    expect(source).toContain("getAgreementStatus");
    expect(source).toContain("ctx.companyId");
  });
});
