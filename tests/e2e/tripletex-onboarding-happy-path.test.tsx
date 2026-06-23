/** @vitest-environment jsdom */

/**
 * TPT-B-7b — Onboarding happy path (mocked actions, MSW-free).
 */
import React, { act } from "react";
import { describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockVerifyTokenAction = vi.fn();
const mockCompleteConnectionAction = vi.fn();
const mockGetHealthAction = vi.fn();
const mockRotateWebhookSecretAction = vi.fn();
const mockFinalizeConnectionAction = vi.fn();

vi.mock("@/app/leverandor/innstillinger/tripletex/koble-til/actions", () => ({
  verifyTokenAction: (...args: unknown[]) => mockVerifyTokenAction(...args),
  completeConnectionAction: (...args: unknown[]) => mockCompleteConnectionAction(...args),
  getHealthAction: (...args: unknown[]) => mockGetHealthAction(...args),
  rotateWebhookSecretAction: (...args: unknown[]) => mockRotateWebhookSecretAction(...args),
  finalizeConnectionAction: (...args: unknown[]) => mockFinalizeConnectionAction(...args),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

import DirectWizard from "@/components/provider/tripletex-wizard/DirectWizard";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("tripletex onboarding happy path (TPT-B-7b)", () => {
  test("provider admin completes wizard steps to success screen", async () => {
    mockVerifyTokenAction.mockResolvedValue({
      ok: true,
      data: {
        auth: { ok: true, error: null },
        company_match: { ok: true, error: null },
        scope: { ok: true, error: null },
        all_passed: true,
      },
    });
    mockCompleteConnectionAction.mockResolvedValue({
      ok: true,
      data: { connection_state: "CONFIGURING" },
    });

    let provisioningPolls = 0;
    mockGetHealthAction.mockImplementation(async () => {
      provisioningPolls += 1;
      return {
        ok: true,
        data: {
          state: "CONFIGURING",
          provisioningComplete: provisioningPolls >= 2,
          tripletexCompanyName: "Test AS",
          stats30d: {},
          recentEvents: [],
        },
      };
    });

    mockRotateWebhookSecretAction.mockResolvedValue({
      ok: true,
      data: {
        webhook_secret: "whsec_abc123",
        webhook_url: "https://app.example/webhook",
      },
    });
    mockFinalizeConnectionAction.mockResolvedValue({
      ok: true,
      data: { connection_state: "CONNECTED" },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const messages = await loadMessagesForLocale("nb");

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="nb" messages={messages}>
          <DirectWizard
            providerId={PROVIDER_ID}
            providerName="Test Provider"
            webhookUrl="https://app.example/webhook"
            initialStep="token"
          />
        </NextIntlClientProvider>,
      );
      await Promise.resolve();
    });

    const companyInput = container.querySelector("#tpt-company-id") as HTMLInputElement;
    const tokenInput = container.querySelector("#tpt-employee-token") as HTMLInputElement;
    await act(async () => {
      setInputValue(companyInput, "114612665");
      setInputValue(tokenInput, "employee-token");
    });

    const verifyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Verifiser"),
    );

    await act(async () => {
      verifyBtn?.click();
      await new Promise((r) => setTimeout(r, 300));
    });

    const continueBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Fortsett"),
    );

    await act(async () => {
      continueBtn?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Setter opp Tripletex");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 3500));
    });

    expect(container.textContent).toContain("Webhook-registrering");
    expect(mockRotateWebhookSecretAction).toHaveBeenCalledWith({ providerId: PROVIDER_ID });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const finalizeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Fullfør oppsett"),
    );

    await act(async () => {
      finalizeBtn?.click();
      await Promise.resolve();
    });

    expect(mockFinalizeConnectionAction).toHaveBeenCalledWith({ providerId: PROVIDER_ID });
    expect(container.textContent).toContain("Tripletex er koblet til");

    root.unmount();
    document.body.innerHTML = "";
  });
});
