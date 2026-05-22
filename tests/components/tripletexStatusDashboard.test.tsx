/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetDashboardDataAction = vi.fn();

vi.mock("@/app/leverandor/innstillinger/tripletex/status/actions", () => ({
  getDashboardDataAction: (...args: unknown[]) => mockGetDashboardDataAction(...args),
  testConnectionAction: vi.fn(),
  disconnectTripletexAction: vi.fn(),
}));

vi.mock("@/app/leverandor/innstillinger/tripletex/koble-til/actions", () => ({
  rotateWebhookSecretAction: vi.fn(),
}));

import StatusDashboardClient from "@/components/provider/tripletex-status/StatusDashboardClient";
import type { DashboardData } from "@/app/leverandor/innstillinger/tripletex/status/actions";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

const BASE_DATA: DashboardData = {
  state: "CONFIGURING",
  stateSince: "2026-05-21T10:00:00Z",
  tripletexCompanyId: 114612665,
  tripletexCompanyName: "Smoke Provider AS",
  lastHealthCheck: null,
  provisioningComplete: true,
  vaultPurgeAt: null,
  daysUntilPurge: null,
  stats30d: {
    invoices_sent: 0,
    invoices_paid: 0,
    worker_failures: 0,
    webhook_events: 0,
  },
  resourceCounts: { products: 3, customers: 1, vatCodes: 2 },
  webhook: {
    url: `https://example.test/api/webhooks/tripletex/provider/${PROVIDER_ID}`,
    lastReceivedAt: null,
    events30d: 0,
    lastRotatedAt: null,
  },
  recentEvents: [],
  warnings: [],
};

async function renderDashboard(isAdmin = false, data: DashboardData = BASE_DATA) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <StatusDashboardClient providerId={PROVIDER_ID} isAdmin={isAdmin} initialData={data} />,
    );
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("StatusDashboardClient (TPT-B-7c)", () => {
  test("CONFIGURING + provisioningComplete shows Konfigurer webhook CTA", async () => {
    const { container } = await renderDashboard(false);
    const cta = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Konfigurer webhook"),
    );
    expect(cta).toBeTruthy();
    expect(cta?.getAttribute("href")).toBe("/leverandor/innstillinger/tripletex/koble-til");
  });

  test("CONNECTED state shows Tilkoblet badge", async () => {
    const { container } = await renderDashboard(false, { ...BASE_DATA, state: "CONNECTED" });
    expect(container.textContent).toContain("Tilkoblet");
  });

  test("admin sees action buttons, viewer does not", async () => {
    const viewer = await renderDashboard(false);
    expect(viewer.container.textContent).not.toContain("Roter webhook-secret");

    document.body.innerHTML = "";
    const admin = await renderDashboard(true);
    expect(admin.container.textContent).toContain("Test tilkobling");
    expect(admin.container.textContent).toContain("Roter webhook-secret");
  });

  test("resource summary renders three cards", async () => {
    const { container } = await renderDashboard(false);
    expect(container.textContent).toContain("Produkter");
    expect(container.textContent).toContain("Kunder");
    expect(container.textContent).toContain("MVA-koder");
  });
});
