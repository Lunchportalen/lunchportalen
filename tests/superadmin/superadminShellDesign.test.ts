import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  deriveOperationalBadge,
  evaluateGoldenPathChecklist,
} from "@/lib/superadmin/pilotControlChecklist";

const ROOT = process.cwd();

function readSource(relPath: string) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

describe("Superadmin shell design system", () => {
  it("layout importerer scoped superadmin-shell.css", () => {
    const layout = readSource("app/superadmin/layout.tsx");
    expect(layout).toContain("superadmin-shell.css");
    expect(layout).toContain('auth.role !== "superadmin"');
  });

  it("ControlTowerNav har påkrevde lenker og ekskluderer Backoffice/Kjøkken/Brukere", () => {
    const nav = readSource("app/superadmin/_components/ControlTowerNav.tsx");
    for (const href of [
      "/superadmin",
      "/superadmin/companies",
      "/superadmin/agreements",
      "/superadmin/system",
      "/superadmin/pilot-control",
      "/superadmin/audit",
      "/superadmin/tripletex",
      "/superadmin/control-tower",
      "/superadmin/operations",
      "/superadmin/global",
    ]) {
      expect(nav).toContain(href);
    }
    expect(nav).not.toContain('label: "Kjøkken"');
    expect(nav).not.toContain('label: "Backoffice"');
    expect(nav).not.toContain('label: "Brukere"');
    expect(nav).not.toContain("/kitchen");
    expect(nav).not.toContain("/backoffice/content");
    expect(nav).not.toContain("/superadmin/users");
    expect(nav).toContain("Umbraco");
  });

  it("SuperadminControlCenter ekskluderer Backoffice, Kjøkken og Brukere", () => {
    const home = readSource("components/superadmin/SuperadminControlCenter.tsx");
    expect(home).not.toContain("/backoffice/content");
    expect(home).not.toContain('href="/kitchen"');
    expect(home).not.toContain("Gå til kjøkken");
    expect(home).not.toContain("/superadmin/users");
    expect(home).not.toContain('fallbackLabel: "Brukere"');
  });

  it("/superadmin/users redirecter til firma (legacy bookmark)", () => {
    const page = readSource("app/superadmin/users/page.tsx");
    expect(page).toContain('redirect("/superadmin/companies")');
    expect(page).not.toContain("SuperadminUsersClient");
  });

  it("Priority 3-sider bruker SuperadminPageShell og SuperadminHero", () => {
    for (const rel of [
      "app/superadmin/audit/page.tsx",
      "app/superadmin/tripletex/page.tsx",
      "app/superadmin/control-tower/page.tsx",
      "app/superadmin/operations/page.tsx",
      "app/superadmin/global/page.tsx",
    ]) {
      const src = readSource(rel);
      expect(src).toContain("SuperadminPageShell");
      expect(src).toContain("SuperadminHero");
      expect(src).not.toContain("lp_order_set");
      expect(src).not.toContain("lp_order_advance_status");
    }
  });

  it("Audit tabell bruker bred HTML-table med break-all (ikke vertikal grid-ID)", () => {
    const audit = readSource("app/superadmin/audit/audit-client.tsx");
    expect(audit).toContain("<table");
    expect(audit).toContain("break-all");
    expect(audit).not.toContain("grid-cols-[180px_220px_220px_1fr_90px]");
  });

  it("Operations har trygg error state (ikke generisk firms error)", () => {
    const err = readSource("app/superadmin/operations/error.tsx");
    expect(err).toContain("SuperadminEmptyState");
    expect(err).not.toContain("Noe gikk galt");
  });

  it("Priority 2-sider bruker SuperadminPageShell og SuperadminHero", () => {
    for (const rel of [
      "app/superadmin/companies/page.tsx",
      "app/superadmin/agreements/page.tsx",
      "app/superadmin/system/page.tsx",
    ]) {
      const src = readSource(rel);
      expect(src).toContain("SuperadminPageShell");
      expect(src).toContain("SuperadminHero");
      expect(src).not.toContain("lp_order_set");
      expect(src).not.toContain("lp_order_advance_status");
    }
  });

  it("Priority 2 klienter introduserer ikke order write-path", () => {
    for (const rel of [
      "app/superadmin/companies/companies-client.tsx",
      "app/superadmin/agreements/agreements-client.tsx",
      "components/superadmin/SuperadminUsersClient.tsx",
      "app/superadmin/system/SystemClient.tsx",
    ]) {
      const src = readSource(rel);
      expect(src).not.toContain("lp_order_set");
      expect(src).not.toContain("lp_order_advance_status");
    }
  });

  it("shell har table surface og empty state primitives", () => {
    const shell = readSource("components/superadmin/shell/SuperadminShell.tsx");
    expect(shell).toContain("SuperadminTableSurface");
    expect(shell).toContain("SuperadminEmptyState");
    expect(shell).toContain("fullWidth");
    const css = readSource("app/styles/ds/superadmin-shell.css");
    expect(css).toContain(".sa-table-surface");
    expect(css).toContain(".sa-empty-state");
    expect(css).toContain(".sa-enterprise-table");
    expect(css).toContain(".sa-page--full");
  });

  it("shell primitives er presentational uten mutation", () => {
    const shell = readSource("components/superadmin/shell/SuperadminShell.tsx");
    expect(shell).not.toMatch(/method=["']POST["']/);
    expect(shell).not.toContain("lp_order_set");
    expect(shell).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });

  it("SuperadminControlCenter bruker command shell", () => {
    const home = readSource("components/superadmin/SuperadminControlCenter.tsx");
    expect(home).toContain("SuperadminPageShell");
    expect(home).toContain("SuperadminHero");
    expect(home).toContain("SuperadminMetricRow");
    expect(home).not.toContain("SignalCard");
  });

  it("Pilot Control Center forblir read-only", () => {
    const pilot = readSource("components/superadmin/PilotControlCenterView.tsx");
    expect(pilot).toContain("SuperadminReadOnlyNotice");
    expect(pilot).toContain("read-only");
    expect(pilot).not.toMatch(/type=["']submit["']/);
    expect(pilot).not.toContain("lp_order_set");
  });
});

describe("Superadmin home render", () => {
  it("har én h1 via SuperadminHero (kildekontrakt)", () => {
    const home = readSource("components/superadmin/SuperadminControlCenter.tsx");
    expect(home).toContain('title="Kontrollsenter"');
    expect(home).toContain("SuperadminHero");
    expect(home).not.toMatch(/<h1[^>]*>[\s\S]*<h1/);
  });
});

describe("Pilot Control Center render (design)", () => {
  it("renderer command hero og checklist uten mutation", async () => {
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
      scopeNote: "Test",
      operationalBadge: deriveOperationalBadge(checklist),
      provider: { id: "p1", name: "Test Leverandør AS", status: "active", membershipCount: 1 },
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
      menu: { upcomingDeliveryDaysExist: true, publishedMenuForNextDay: true, nextDeliveryDay: "2026-06-17", detail: "OK" },
      cutoff: {
        todayStatus: "TODAY_OPEN" as const,
        todayLabel: "Cutoff åpen",
        providerCanProcessAfterCutoff: true,
        detail: "Info",
      },
      healthFlags: {
        goldenPathOk: true,
        providerOrderVisible: true,
        employeeOrderExists: true,
        productionStatusFlowProven: true,
        manualControlRequired: true,
      },
      checklist,
      links: { companyAdmin: "/superadmin/companies/c1", providerOrders: "/leverandor/ordrer", weekView: "/week" },
      emptyState: false,
      emptyMessage: null,
    };

    const { default: PilotControlCenterView } = await import("@/components/superadmin/PilotControlCenterView");
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(React.createElement(PilotControlCenterView, { data }));

    expect(html).toContain("Pilot Control Center");
    expect(html).toContain("GO with manual control");
    expect(html).toContain("sa-checklist");
    expect(html).toContain("Verifisert pilotordre");
    expect(html).toContain("Ingen handling fra denne siden");
    expect(html).not.toContain('type="submit"');
  });
});
