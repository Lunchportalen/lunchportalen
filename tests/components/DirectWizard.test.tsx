/** @vitest-environment jsdom */

/**
 * TPT-B-7b — DirectWizard component tests.
 */
import React, { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

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
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

import DirectWizard from "@/components/provider/tripletex-wizard/DirectWizard";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function renderUi(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("DirectWizard (TPT-B-7b)", () => {
  test("renders Step 1 first", async () => {
    const { container } = await renderUi(
      <DirectWizard
        providerId={PROVIDER_ID}
        providerName="Test Provider"
        webhookUrl="https://app.example/webhook"
        initialStep="token"
      />,
    );
    expect(container.textContent).toContain("Lim inn og verifiser");
  });

  test("verify flow updates verify list incrementally", async () => {
    mockVerifyTokenAction.mockResolvedValue({
      ok: true,
      data: {
        auth: { ok: true, error: null },
        company_match: { ok: true, error: null },
        scope: { ok: true, error: null },
        all_passed: true,
      },
    });

    const { container } = await renderUi(
      <DirectWizard
        providerId={PROVIDER_ID}
        providerName="Test Provider"
        webhookUrl="https://app.example/webhook"
        initialStep="token"
      />,
    );

    const companyInput = container.querySelector("#tpt-company-id") as HTMLInputElement;
    const tokenInput = container.querySelector("#tpt-employee-token") as HTMLInputElement;
    await act(async () => {
      setInputValue(companyInput, "114612665");
      setInputValue(tokenInput, "employee-token");
    });

    const verifyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Verifiser"),
    );
    expect(verifyBtn).toBeTruthy();

    await act(async () => {
      verifyBtn?.click();
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(mockVerifyTokenAction).toHaveBeenCalled();
    expect(container.textContent).toContain("Tilkobling OK");
  });

  test("auth failure marks later verify items as Ikke kjørt", async () => {
    mockVerifyTokenAction.mockResolvedValue({
      ok: true,
      data: {
        auth: { ok: false, error: "Token avvist av Tripletex" },
        company_match: { ok: false, error: null },
        scope: { ok: false, error: null },
        all_passed: false,
      },
    });

    const { container } = await renderUi(
      <DirectWizard
        providerId={PROVIDER_ID}
        providerName="Test Provider"
        webhookUrl="https://app.example/webhook"
        initialStep="token"
      />,
    );

    const companyInput = container.querySelector("#tpt-company-id") as HTMLInputElement;
    const tokenInput = container.querySelector("#tpt-employee-token") as HTMLInputElement;
    await act(async () => {
      setInputValue(companyInput, "114612665");
      setInputValue(tokenInput, "bad-token");
    });

    const verifyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Verifiser"),
    );

    await act(async () => {
      verifyBtn?.click();
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(container.textContent).toContain("Token avvist av Tripletex");
    expect(container.textContent).toContain("Ikke kjørt");
    expect(container.querySelectorAll(".ds-verify-item--skipped").length).toBe(2);
  });

  test("Fortsett disabled before verify success", async () => {
    const { container } = await renderUi(
      <DirectWizard
        providerId={PROVIDER_ID}
        providerName="Test Provider"
        webhookUrl="https://app.example/webhook"
        initialStep="token"
      />,
    );

    const continueBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Fortsett"),
    );
    expect(continueBtn).toBeUndefined();
  });

  test("Step 2 polling stops on unmount", async () => {
    vi.useFakeTimers();
    mockGetHealthAction.mockResolvedValue({
      ok: true,
      data: {
        state: "CONFIGURING",
        provisioningComplete: false,
        tripletexCompanyName: null,
        stats30d: {},
        recentEvents: [],
      },
    });

    const { root } = await renderUi(
      <DirectWizard
        providerId={PROVIDER_ID}
        providerName="Test Provider"
        webhookUrl="https://app.example/webhook"
        initialStep="provisioning"
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(9000);
    });

    expect(mockGetHealthAction.mock.calls.length).toBeGreaterThan(0);
    const callsBefore = mockGetHealthAction.mock.calls.length;

    await act(async () => {
      root.unmount();
      vi.advanceTimersByTime(9000);
    });

    expect(mockGetHealthAction.mock.calls.length).toBe(callsBefore);
    vi.useRealTimers();
  });

  test("Step 3 finalize disabled without confirmation", async () => {
    mockRotateWebhookSecretAction.mockResolvedValue({
      ok: true,
      data: { webhook_secret: "whsec_test", webhook_url: "https://app.example/webhook" },
    });

    const { container } = await renderUi(
      <DirectWizard
        providerId={PROVIDER_ID}
        providerName="Test Provider"
        webhookUrl="https://app.example/webhook"
        initialStep="webhook"
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const finalizeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Fullfør"),
    ) as HTMLButtonElement;
    expect(finalizeBtn?.disabled).toBe(true);
  });

  test("prefers-reduced-motion: progress steps render without animation dependency", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    const { container } = await renderUi(
      <DirectWizard
        providerId={PROVIDER_ID}
        providerName="Test Provider"
        webhookUrl="https://app.example/webhook"
        initialStep="token"
      />,
    );

    expect(container.querySelector(".ds-wizard__progress-step")).toBeTruthy();
  });
});
