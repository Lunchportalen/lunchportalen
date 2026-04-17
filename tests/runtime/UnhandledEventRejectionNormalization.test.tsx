/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { SUPERADMIN_EMAIL } from "@/lib/system/emails";

(global as any).React = React;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const searchParamsState = {
  next: "/backoffice/content" as string | null,
};

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "next" ? searchParamsState.next : null) }),
  useRouter: () => ({ push: pushMock }),
  redirect: vi.fn(),
}));

async function renderLoginForm(localRuntimeCredentials: { email: string; password: string } | null) {
  const LoginForm = (await import("@/app/(auth)/login/LoginForm")).default;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(LoginForm, {
        authRuntime: {
          ok: true,
          url: "https://test.supabase.co",
          anonKey: "anon-key",
          issue: null,
          message: null,
        },
        localRuntimeCredentials,
      }),
    );
    await Promise.resolve();
  });
  return { container, root };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  pushMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  searchParamsState.next = "/backoffice/content";
  document.body.innerHTML = "";
});

describe("Unhandled Event rejection normalization", () => {
  it("exposes local runtime credentials without rendering a bypass button", async () => {
    const { container } = await renderLoginForm({
      email: SUPERADMIN_EMAIL,
      password: "Lunchportalen123!",
    });

    expect(container.textContent).toContain("Lokal runtime-konto");
    expect(container.textContent).toContain(SUPERADMIN_EMAIL);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "Åpne lokal utviklingsøkt",
      ),
    ).toBe(false);
  });

  it("handles raw Event reasons locally during login submit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Event("error")));
    (global as any).window.location = { assign: vi.fn() };

    const unhandledReasons: unknown[] = [];
    const onUnhandled = (event: Event) => {
      const rejectionEvent = event as PromiseRejectionEvent;
      unhandledReasons.push(rejectionEvent.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandled);

    const { container } = await renderLoginForm({
      email: SUPERADMIN_EMAIL,
      password: "Lunchportalen123!",
    });
    const emailInput = container.querySelector('input[autocomplete="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    await act(async () => {
      setInputValue(emailInput, "superadmin@example.com");
      setInputValue(passwordInput, "secret123");
    });

    await act(async () => {
      submit.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Innloggingstjenesten svarte ikke");
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toBe("Logg inn");
    expect((global as any).window.location.assign).not.toHaveBeenCalled();
    expect(unhandledReasons).toEqual([]);

    window.removeEventListener("unhandledrejection", onUnhandled);
  });
});
