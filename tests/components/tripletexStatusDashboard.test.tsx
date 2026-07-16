/** @vitest-environment jsdom */

import React from "react";
import { act } from "@/tests/_helpers/reactAct";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    subscriptionCount: 3,
    eventTypes: ["invoice.charged", "closegroup.create", "order.update"],
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

async function renderDashboard(
  locale: "nb" | "en",
  isAdmin = false,
  data: DashboardData = BASE_DATA,
) {
  const messages = await loadMessagesForLocale(locale);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <StatusDashboardClient providerId={PROVIDER_ID} isAdmin={isAdmin} initialData={data} />
      </NextIntlClientProvider>,
    );
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("StatusDashboardClient (TPT-B-7c i18n)", () => {
  test("CONFIGURING + provisioningComplete shows translated webhook CTA (nb)", async () => {
    const { container } = await renderDashboard("nb", false);
    expect(container.textContent).toContain("Konfigurer webhook");
  });

  test("CONNECTED state shows translated badge (nb)", async () => {
    const { container } = await renderDashboard("nb", false, { ...BASE_DATA, state: "CONNECTED" });
    expect(container.textContent).toContain("Tilkoblet");
  });

  test("CONNECTED state shows English badge when locale is en", async () => {
    const { container } = await renderDashboard("en", false, { ...BASE_DATA, state: "CONNECTED" });
    expect(container.textContent).toContain("Connected");
  });

  test("preserves Tripletex company name and webhook URL as data", async () => {
    const { container } = await renderDashboard("nb", false, { ...BASE_DATA, state: "CONNECTED" });
    expect(container.textContent).toContain("Smoke Provider AS");
    expect(container.textContent).toContain("114612665");
    expect(container.textContent).toContain("invoice.charged");
    expect(container.textContent).toContain(`https://example.test/api/webhooks/tripletex/provider/${PROVIDER_ID}`);
  });

  test("admin sees translated action buttons (nb)", async () => {
    const admin = await renderDashboard("nb", true, { ...BASE_DATA, state: "CONNECTED" });
    expect(admin.container.textContent).toContain("Test tilkobling");
    expect(admin.container.textContent).toContain("Koble fra");
  });

  test("resource summary renders translated stat labels (nb)", async () => {
    const { container } = await renderDashboard("nb", false);
    expect(container.textContent).toContain("Produkter");
    expect(container.textContent).toContain("MVA-koder");
  });

  test("webhook section shows subscription count with data preserved", async () => {
    const { container } = await renderDashboard("nb", false, { ...BASE_DATA, state: "CONNECTED" });
    expect(container.textContent).toContain("3 aktive i Tripletex");
  });
});
