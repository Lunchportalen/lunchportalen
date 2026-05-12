// @ts-nocheck
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

globalThis.React = React;

const COMPANY_ID = "d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7";

let ctx: any;
let result: any;

vi.mock("@/lib/admin/loadAdminContext", () => ({
  loadAdminContext: vi.fn(async () => ctx),
  isAdminContextBlocked: (value: any) => value?.ok === false,
}));

vi.mock("@/lib/admin/fetchAgreementPageDataServer", () => ({
  fetchAgreementPageDataForAdmin: vi.fn(async () => result),
}));

function okContext(overrides?: any) {
  return {
    ok: true,
    user: { id: "u1" },
    role: "company_admin",
    profile: { role: "company_admin", email: "inger@example.no", company_id: COMPANY_ID, location_id: "loc_1" },
    companyId: COMPANY_ID,
    companyStatus: "active",
    company: { id: COMPANY_ID, name: "Melhus", status: "ACTIVE" },
    counts: {
      employeesTotal: 12,
      employeesActive: 10,
      employeesDisabled: 2,
      locationsTotal: 1,
      ordersTodayActive: 3,
      ordersWeekActive: 9,
    },
    dbg: { authUserId: "u1", authEmail: "inger@example.no" },
    ...overrides,
  };
}

function blockedContext(blocked: string) {
  return {
    ok: false,
    blocked,
    user: { id: "u1" },
    role: "company_admin",
    profile: { role: "company_admin", email: "inger@example.no", company_id: COMPANY_ID, location_id: "loc_1" },
    companyId: COMPANY_ID,
    companyStatus: blocked === "COMPANY_INACTIVE" ? "paused" : "active",
    company: { id: COMPANY_ID, name: "Melhus", status: blocked === "COMPANY_INACTIVE" ? "PAUSED" : "ACTIVE" },
    counts: null,
    dbg: { authUserId: "u1", authEmail: "inger@example.no" },
    support: { reason: blocked, companyId: COMPANY_ID, locationId: "loc_1" },
    nextSteps: ["Kontakt superadmin."],
  };
}

function agreementData(dayTiers: Record<string, string | null>) {
  const labels: any = { mon: "Man", tue: "Tir", wed: "Ons", thu: "Tor", fri: "Fre" };
  const deliveryDays = ["mon", "tue", "wed", "thu", "fri"];
  return {
    rid: "rid_test",
    company: { id: COMPANY_ID, name: "Melhus" },
    companies: [{ id: COMPANY_ID, name: "Melhus" }],
    role: "company_admin",
    status: "ACTIVE",
    pricing: {
      planTier: Object.values(dayTiers).find(Boolean) ?? null,
      dayTiers,
      pricePerCuvertNok: 99,
      currency: "NOK",
    },
    binding: { startDate: "2026-01-01", endDate: null, remainingDays: null },
    terms: { bindingMonths: 12, noticeMonths: 3 },
    weekPlan: deliveryDays.map((dayKey) => ({
      dayKey,
      label: labels[dayKey],
      active: true,
      tier: dayTiers[dayKey] ?? null,
      reasonIfInactive: null,
    })),
    metrics: {
      employeesTotal: 12,
      employeesActive: 10,
      employeesDeactivated: 2,
      cancelsBeforeCutoff7d: 1,
      ordersToday: 3,
    },
    updatedAt: "2026-05-12T10:00:00.000Z",
    cutoff: { time: "08:00", timezone: "Europe/Oslo" },
    sourceOfTruth: { companyId: COMPANY_ID, agreementId: "agr_1", updatedAt: "2026-05-12T10:00:00.000Z" },
  };
}

async function renderPage() {
  const mod = await import("@/app/admin/agreement/page");
  const element = await mod.default();
  return renderToStaticMarkup(element as React.ReactElement);
}

beforeEach(() => {
  vi.resetModules();
  ctx = okContext();
  result = { kind: "ok", data: agreementData({ mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" }), rid: "rid_test" };
});

describe("app/admin/agreement/page", () => {
  test("rendrer blandet tier i WeekPreview", async () => {
    result = {
      kind: "ok",
      data: agreementData({ mon: "BASIS", tue: "BASIS", wed: "LUXUS", thu: "BASIS", fri: "LUXUS" }),
      rid: "rid_test",
    };

    const html = await renderPage();

    expect(html).toContain("Man");
    expect(html).toContain("Tir");
    expect(html).toContain("Ons");
    expect(html).toContain("Tor");
    expect(html).toContain("Fre");
    expect(html.match(/Basis/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(html.match(/Luxus/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test("rendrer ENTERPRISE-tier", async () => {
    result = {
      kind: "ok",
      data: agreementData({ mon: "BASIS", tue: "BASIS", wed: "ENTERPRISE", thu: "BASIS", fri: "LUXUS" }),
      rid: "rid_test",
    };

    const html = await renderPage();

    expect(html).toContain("Enterprise");
  });

  test("viser 'Ikke spesifisert' når tier mangler", async () => {
    result = {
      kind: "ok",
      data: agreementData({ mon: null, tue: "BASIS", wed: "LUXUS", thu: "BASIS", fri: "LUXUS" }),
      rid: "rid_test",
    };

    const html = await renderPage();

    expect(html).toContain("Ikke spesifisert");
  });

  test("viser blandet tier-label i Plan og pris", async () => {
    result = {
      kind: "ok",
      data: agreementData({ mon: "BASIS", tue: "BASIS", wed: "LUXUS", thu: "BASIS", fri: "LUXUS" }),
      rid: "rid_test",
    };

    const html = await renderPage();

    expect(html).toContain("Blandet");
    expect(html).toContain("3 dager Basis");
    expect(html).toContain("2 dager Luxus");
  });

  test("COMPANY_STATUS_CHECK_FAILED kastes IKKE for aktiv firma med ACTIVE agreement", async () => {
    ctx = okContext({ companyStatus: "active", company: { id: COMPANY_ID, name: "Melhus", status: "ACTIVE" } });
    result = { kind: "ok", data: agreementData({ mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" }), rid: "rid_test" };

    const html = await renderPage();

    expect(html).toContain("Avtalesammendrag");
    expect(html).not.toContain("COMPANY_STATUS_CHECK_FAILED");
    expect(html).not.toContain("Kunne ikke hente avtalen");
  });

  test("ACCOUNT_DISABLED/COMPANY_INACTIVE/FORBIDDEN-blokker bevares", async () => {
    const titles: Record<string, string> = {
      ACCOUNT_DISABLED: "Konto er deaktivert",
      COMPANY_INACTIVE: "Firma er ikke aktivt",
      FORBIDDEN: "Ikke firmaadmin-flate for denne rollen",
    };

    for (const reason of ["ACCOUNT_DISABLED", "COMPANY_INACTIVE", "FORBIDDEN"]) {
      ctx = blockedContext(reason);
      const html = await renderPage();

      expect(html).toContain(titles[reason]);
      expect(html).toContain("Kontakt superadmin.");
      expect(html).not.toContain("Kunne ikke hente avtalen");
    }
  });
});
