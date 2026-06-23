import { describe, expect, it } from "vitest";

import type { ProviderActivityItem } from "@/lib/providers/loadProviderDashboard";
import { buildProviderFollowUps, mapProviderDashboardActivity } from "@/lib/providers/providerDashboardActivity";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

function row(overrides: Partial<ProviderActivityItem>): ProviderActivityItem {
  return {
    id: "row-1",
    createdAt: "2026-06-10T08:00:00.000Z",
    action: "unknown",
    entityType: "company",
    reason: null,
    ...overrides,
  };
}

describe("mapProviderDashboardActivity", () => {
  it("skjuler rå tekniske audit-events (delete · company)", () => {
    const out = mapProviderDashboardActivity([
      row({ id: "a", action: "delete", entityType: "company", reason: "test test test test" }),
      row({ id: "b", action: "insert", entityType: "company" }),
      row({ id: "c", action: "update", entityType: "agreement" }),
      row({ id: "d", action: "agreement_billing_cron_completed", entityType: "agreement_billing_cron" }),
      row({ id: "e", action: "agreement_lifecycle_hook_fired", entityType: "agreement" }),
    ]);
    expect(out).toEqual([]);
  });

  it("skjuler ukjente/test-events", () => {
    const out = mapProviderDashboardActivity([
      row({ id: "a", action: "test", reason: "test" }),
      row({ id: "b", action: "debug_event" }),
      row({ id: "c", action: "" }),
    ]);
    expect(out).toEqual([]);
  });

  it("mapper kjente events til provider-safe i18n messageIds", () => {
    const out = mapProviderDashboardActivity([
      row({ id: "a", action: "company_registration_approved" }),
      row({ id: "b", action: "agreement_invoice_generated" }),
      row({ id: "c", action: "order_received" }),
      row({ id: "d", action: "order_cancelled" }),
      row({ id: "e", action: "menu_published" }),
    ]);

    expect(out.map((i) => i.messageId)).toEqual([
      "registrationApproved",
      "invoiceGenerated",
      "orderReceived",
      "orderCancelled",
      "menuPublished",
    ]);
    expect(out.map((i) => i.tone)).toEqual(["success", "neutral", "success", "warning", "success"]);
  });

  it("rendrer aldri rå reason-fritekst — kun messageId returneres", () => {
    const out = mapProviderDashboardActivity([
      row({ id: "a", action: "company_registration_approved", reason: "test test test intern debug" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.messageId).toBe("registrationApproved");
    expect(JSON.stringify(out)).not.toContain("test test test");
    expect(JSON.stringify(out)).not.toContain("description");
  });

  it("ingen rå 'delete · company' kan rendres gjennom mapperen", () => {
    const out = mapProviderDashboardActivity([
      row({ id: "a", action: "delete", entityType: "company" }),
      row({ id: "b", action: "company_registration_rejected" }),
    ]);
    const rendered = JSON.stringify(out);
    expect(rendered).not.toContain("delete");
    expect(rendered).not.toMatch(/\bcompany\b/);
    expect(out).toHaveLength(1);
    expect(out[0]!.messageId).toBe("registrationRejected");
  });

  it("rad uten id hoppes over", () => {
    const out = mapProviderDashboardActivity([row({ id: "", action: "menu_published" })]);
    expect(out).toEqual([]);
  });

  it("nb activity messages matcher forventet norsk copy", async () => {
    const messages = await loadMessagesForLocale("nb");
    const activity = (messages.provider as { dashboard: { activity: Record<string, { title: string; description: string }> } })
      .dashboard.activity;

    expect(activity.registrationApproved.title).toBe("Kunde godkjent");
    expect(activity.registrationApproved.description).toBe("En kunderegistrering er godkjent og aktivert.");
  });
});

describe("buildProviderFollowUps", () => {
  const base = {
    menuEditingEnabled: true,
    ordersThisWeek: 4,
    activeCustomers: 3,
    revenueLast30DaysNok: 12500,
  };

  it("ingen follow-ups når alt er normalt", () => {
    expect(buildProviderFollowUps(base)).toEqual([]);
  });

  it("menyeditor deaktivert → menystatus-kort", () => {
    const out = buildProviderFollowUps({ ...base, menuEditingEnabled: false });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "menu-editing-disabled",
      title: "Menyredigering ikke aktivert",
      href: "/leverandor/meny",
      tone: "neutral",
    });
  });

  it("0 ordre denne uken → ordre-kort", () => {
    const out = buildProviderFollowUps({ ...base, ordersThisWeek: 0 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "no-orders-this-week",
      title: "Ingen ordre denne uken",
      href: "/leverandor/ordrer",
    });
  });

  it("aktive kunder > 0 og 0 ordreverdi siste 30 dager → faktura-kort", () => {
    const out = buildProviderFollowUps({ ...base, revenueLast30DaysNok: 0 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "no-revenue-30d",
      title: "Ingen ordreverdi siste 30 dager",
      href: "/leverandor/faktura",
    });
  });

  it("0 kunder og 0 ordreverdi → ikke fakturakort (ikke et problem ennå)", () => {
    const out = buildProviderFollowUps({
      ...base,
      activeCustomers: 0,
      revenueLast30DaysNok: 0,
      ordersThisWeek: 1,
    });
    expect(out.find((i) => i.id === "no-revenue-30d")).toBeUndefined();
  });

  it("alle tre samtidig → tre kort i prioritert rekkefølge", () => {
    const out = buildProviderFollowUps({
      menuEditingEnabled: false,
      ordersThisWeek: 0,
      activeCustomers: 2,
      revenueLast30DaysNok: 0,
    });
    expect(out.map((i) => i.id)).toEqual(["menu-editing-disabled", "no-orders-this-week", "no-revenue-30d"]);
  });
});
