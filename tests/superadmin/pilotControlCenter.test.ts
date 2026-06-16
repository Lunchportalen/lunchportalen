import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  deriveOperationalBadge,
  evaluateGoldenPathChecklist,
} from "@/lib/superadmin/pilotControlChecklist";
import { buildPilotLatestOrderDisplayLine } from "@/lib/superadmin/loadPilotControlCenter";
import { mergePilotScope, pilotScopeFromEnv, pilotScopeFromQuery } from "@/lib/superadmin/pilotControlConfig";

const ROOT = process.cwd();

function readSource(relPath: string) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

describe("pilot order display line", () => {
  it("viser varianttittel i stedet for product_name_snapshot", () => {
    const line = buildPilotLatestOrderDisplayLine({
      quantity: 1,
      productNameSnapshot: "Paasmurt",
      choiceKey: "paasmurt",
      itemKey: "laks-eggerore",
      itemTitleSnapshot: "Laks & Eggerøre",
    });
    expect(line).toBe("1 stk · Påsmurt · Laks & Eggerøre");
    expect(line).not.toContain("Paasmurt");
  });

  it("resolver variant fra lookup når snapshot mangler", () => {
    const lookup = new Map<string, string>([["paasmurt:laks-eggerore", "Laks & Eggerøre"]]);
    const line = buildPilotLatestOrderDisplayLine({
      quantity: 1,
      productNameSnapshot: "Paasmurt",
      choiceKey: "paasmurt",
      itemKey: "laks-eggerore",
      itemTitleSnapshot: null,
      variantLookup: lookup,
    });
    expect(line).toBe("1 stk · Påsmurt · Laks & Eggerøre");
    expect(line).not.toContain("Paasmurt");
  });

  it("fallback til kun kategori når variant mangler", () => {
    const line = buildPilotLatestOrderDisplayLine({
      quantity: 1,
      productNameSnapshot: "Paasmurt",
      choiceKey: "paasmurt",
      itemKey: null,
      itemTitleSnapshot: null,
    });
    expect(line).toBe("1 stk · Påsmurt");
    expect(line).not.toContain("Paasmurt");
  });
});

describe("pilotControlConfig", () => {
  it("merger query over env over auto", () => {
    const query = pilotScopeFromQuery({
      companyId: "11111111-1111-4111-8111-111111111111",
    });
    const env = pilotScopeFromEnv();
    const merged = mergePilotScope(query, env, {
      companyId: "22222222-2222-4222-8222-222222222222",
      providerId: "33333333-3333-4333-8333-333333333333",
    });
    expect(merged.source).toBe("query");
    expect(merged.companyId).toBe("11111111-1111-4111-8111-111111111111");
    expect(merged.providerId).toBe("33333333-3333-4333-8333-333333333333");
  });
});

describe("pilotControlChecklist", () => {
  it("gir GO with manual control når kjerne-steg passerer", () => {
    const checklist = evaluateGoldenPathChecklist({
      companyActive: true,
      agreementActive: true,
      employeesActive: 1,
      menuPublishedForUpcoming: true,
      ordersThisWeek: 2,
      latestOrderStatus: "PREPARED",
      latestOrderHasDisplayLine: true,
      providerMatchesScope: true,
    });
    expect(deriveOperationalBadge(checklist)).toBe("GO with manual control");
    expect(checklist.some((c) => c.label === "Firma aktivt" && c.level === "PASS")).toBe(true);
  });

  it("gir STOP når firma eller avtale feiler", () => {
    const checklist = evaluateGoldenPathChecklist({
      companyActive: false,
      agreementActive: false,
      employeesActive: 0,
      menuPublishedForUpcoming: false,
      ordersThisWeek: 0,
      latestOrderStatus: null,
      latestOrderHasDisplayLine: false,
      providerMatchesScope: false,
    });
    expect(deriveOperationalBadge(checklist)).toBe("STOP");
  });
});

describe("loadPilotControlCenter read-only contract", () => {
  it("loader bruker provider display helper for ordrelinje", () => {
    const src = readSource("lib/superadmin/loadPilotControlCenter.ts");
    expect(src).toContain("buildKitchenOrderItemDisplay");
    expect(src).toContain("buildVariantTitleLookup");
    expect(src).not.toContain("function buildDisplayLine");
  });

  it("loader importerer ikke lp_order_set eller order write-path", () => {
    const src = readSource("lib/superadmin/loadPilotControlCenter.ts");
    expect(src).not.toContain("lp_order_set");
    expect(src).not.toContain("lp_order_advance_status");
    expect(src).not.toMatch(/from\s+["']@\/lib\/orders\//);
    expect(src).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });

  it("page importerer ikke lp_order_set eller mutation routes", () => {
    const pageSrc = readSource("app/superadmin/pilot-control/page.tsx");
    const viewSrc = readSource("components/superadmin/PilotControlCenterView.tsx");
    for (const src of [pageSrc, viewSrc]) {
      expect(src).not.toContain("lp_order_set");
      expect(src).not.toMatch(/method=["']POST["']/);
      expect(src).not.toMatch(/type=["']submit["']/);
    }
  });

  it("superadmin layout guard krever superadmin-rolle", () => {
    const layout = readSource("app/superadmin/layout.tsx");
    expect(layout).toContain('auth.role !== "superadmin"');
  });
});

describe("PilotControlCenterView render", () => {
  it("viser tittel, badge, checklist og beskyttelsesvarsel", async () => {
    const checklist = evaluateGoldenPathChecklist({
      companyActive: true,
      agreementActive: true,
      employeesActive: 1,
      menuPublishedForUpcoming: true,
      ordersThisWeek: 1,
      latestOrderStatus: "DELIVERED",
      latestOrderHasDisplayLine: true,
      providerMatchesScope: true,
    });

    const data = {
      checkedAt: "2026-06-16T10:00:00",
      scope: { companyId: "c1", providerId: "p1", source: "auto" as const },
      scopeNote: "Test scope",
      operationalBadge: deriveOperationalBadge(checklist),
      provider: { id: "p1", name: "Test Leverandør AS", status: "active", membershipCount: 2 },
      company: {
        id: "c1",
        name: "Test Firma AS",
        status: "active",
        agreementStatus: "ACTIVE",
        agreementActive: true,
        employeesActive: 1,
        pendingInvites: 0,
        primaryLocationName: "Hovedlokasjon",
      },
      orders: {
        today: 1,
        thisWeek: 1,
        statusCounts: { mottatt: 0, iProduksjon: 0, klarForLevering: 0, levert: 1 },
        latest: {
          id: "o1",
          companyName: "Test Firma AS",
          locationName: "Hovedlokasjon",
          employeeName: "Test Ansatt",
          employeeEmail: "test@example.com",
          displayLine: "1 stk · Påsmurt · Laks & Eggerøre",
          statusRaw: "DELIVERED",
          statusLabel: "Levert",
          date: "2026-06-16",
          createdAt: "2026-06-16T07:00:00",
          updatedAt: "2026-06-16T09:00:00",
        },
        productionSummary: "1 levert",
      },
      menu: {
        upcomingDeliveryDaysExist: true,
        publishedMenuForNextDay: true,
        nextDeliveryDay: "2026-06-17",
        detail: "Publisert meny funnet.",
      },
      cutoff: {
        todayStatus: "TODAY_OPEN" as const,
        todayLabel: "Cutoff i dag: åpen (til 08:00)",
        providerCanProcessAfterCutoff: true,
        detail: "Info only.",
      },
      healthFlags: {
        goldenPathOk: true,
        providerOrderVisible: true,
        employeeOrderExists: true,
        productionStatusFlowProven: true,
        manualControlRequired: true,
      },
      checklist,
      links: {
        companyAdmin: "/superadmin/companies/c1",
        providerOrders: "/leverandor/ordrer",
        weekView: "/week",
      },
      emptyState: false,
      emptyMessage: null,
    };

    const { default: PilotControlCenterView } = await import("@/components/superadmin/PilotControlCenterView");
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(React.createElement(PilotControlCenterView, { data }));

    expect(html).toContain("Pilot Control Center");
    expect(html).toContain("GO with manual control");
    expect(html).toContain("Golden Path checklist");
    expect(html).toContain("1 stk · Påsmurt · Laks &amp; Eggerøre");
    expect(html).not.toContain("Paasmurt");
    expect(html).toContain("Denne siden er read-only");
    expect(html).not.toContain('type="submit"');
  });

  it("viser trygg empty state uten data", async () => {
    const checklist = evaluateGoldenPathChecklist({
      companyActive: false,
      agreementActive: false,
      employeesActive: 0,
      menuPublishedForUpcoming: false,
      ordersThisWeek: 0,
      latestOrderStatus: null,
      latestOrderHasDisplayLine: false,
      providerMatchesScope: false,
    });

    const data = {
      checkedAt: "2026-06-16T10:00:00",
      scope: { companyId: null, providerId: null, source: "none" as const },
      scopeNote: "Ingen scope",
      operationalBadge: deriveOperationalBadge(checklist),
      provider: null,
      company: null,
      orders: {
        today: 0,
        thisWeek: 0,
        statusCounts: { mottatt: 0, iProduksjon: 0, klarForLevering: 0, levert: 0 },
        latest: null,
        productionSummary: "Ingen ordre",
      },
      menu: {
        upcomingDeliveryDaysExist: false,
        publishedMenuForNextDay: false,
        nextDeliveryDay: null,
        detail: "—",
      },
      cutoff: {
        todayStatus: "TODAY_OPEN" as const,
        todayLabel: "Cutoff",
        providerCanProcessAfterCutoff: true,
        detail: "—",
      },
      healthFlags: {
        goldenPathOk: false,
        providerOrderVisible: false,
        employeeOrderExists: false,
        productionStatusFlowProven: false,
        manualControlRequired: true,
      },
      checklist,
      links: { companyAdmin: null, providerOrders: "/leverandor/ordrer", weekView: "/week" },
      emptyState: true,
      emptyMessage: "Pilot-scope ikke funnet.",
    };

    const { default: PilotControlCenterView } = await import("@/components/superadmin/PilotControlCenterView");
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(React.createElement(PilotControlCenterView, { data }));

    expect(html).toContain("Ingen pilot-data");
    expect(html).toContain("Pilot-scope ikke funnet.");
  });
});
