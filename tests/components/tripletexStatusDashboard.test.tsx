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
    lastRotatedAt: "2026-05-21T11:00:00Z",
  },
  recentEvents: [
    {
      action: "tripletex_onboarding_provisioning_completed",
      created_at: "2026-05-21T12:00:00Z",
      metadata: null,
    },
  ],
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

describe("StatusDashboardClient (TPT-B-7c polish-7)", () => {
  test("CONFIGURING + provisioningComplete shows Konfigurer webhook CTA in hero strip", async () => {
    const { container } = await renderDashboard(false);
    const cta = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Konfigurer webhook"),
    );
    expect(cta).toBeTruthy();
    expect(cta?.className).toContain("ds-tripletex-status__hero-cta");
  });

  test("does not render nested ds-surface wrappers", async () => {
    const { container } = await renderDashboard(true);
    expect(container.querySelector(".ds-surface")).toBeNull();
  });

  test("uses section dividers and activity row layout", async () => {
    const { container } = await renderDashboard(false);
    expect(container.querySelectorAll(".ds-tripletex-status__section").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector(".ds-tripletex-status__activity-row")).toBeTruthy();
    expect(container.querySelector(".ds-tripletex-status__activity-stats")).toBeTruthy();
  });

  test("CONNECTED state shows Tilkoblet badge", async () => {
    const { container } = await renderDashboard(false, { ...BASE_DATA, state: "CONNECTED" });
    expect(container.textContent).toContain("Tilkoblet");
  });

  test("admin sees action buttons, viewer does not", async () => {
    const viewer = await renderDashboard(false);
    expect(viewer.container.textContent).not.toContain("Roter webhook-secret");

    document.body.innerHTML = "";
    const admin = await renderDashboard(true, { ...BASE_DATA, state: "CONNECTED" });
    expect(admin.container.textContent).toContain("Test tilkobling");
    expect(admin.container.textContent).toContain("Koble fra");
  });

  test("resource summary renders stat numbers without duplicate section headings", async () => {
    const { container } = await renderDashboard(false);
    expect(container.textContent).toContain("Produkter");
    expect(container.textContent).toContain("MVA-koder");
    expect(container.querySelector(".ds-tripletex-status__stat-number")).toBeTruthy();
  });
});
