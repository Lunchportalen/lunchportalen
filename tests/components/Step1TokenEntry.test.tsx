/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockVerifyTokenAction = vi.fn();
const mockCompleteConnectionAction = vi.fn();

vi.mock("@/app/leverandor/innstillinger/tripletex/koble-til/actions", () => ({
  verifyTokenAction: (...args: unknown[]) => mockVerifyTokenAction(...args),
  completeConnectionAction: (...args: unknown[]) => mockCompleteConnectionAction(...args),
}));

import Step1TokenEntry from "@/components/provider/tripletex-wizard/Step1TokenEntry";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function eyebrowText(container: HTMLElement): string {
  return container.querySelector(".ds-eyebrow")?.textContent?.trim() ?? "";
}

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function renderStep1() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<Step1TokenEntry providerId={PROVIDER_ID} onComplete={() => {}} />);
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("Step1TokenEntry eyebrow", () => {
  test("shows Steg 1 av 5 at idle", async () => {
    const { container } = await renderStep1();
    expect(eyebrowText(container)).toBe("Steg 1 av 5");
  });

  test("shows Steg 1 av 5 while verifying", async () => {
    mockVerifyTokenAction.mockImplementation(() => new Promise(() => {}));

    const { container } = await renderStep1();

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
      await Promise.resolve();
    });

    expect(mockVerifyTokenAction).toHaveBeenCalled();
    expect(eyebrowText(container)).toBe("Steg 1 av 5");
    expect(eyebrowText(container)).not.toContain("Steg 2");
  });
});
