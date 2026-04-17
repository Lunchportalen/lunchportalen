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

async function renderLoginForm() {
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
        localRuntimeCredentials: {
          email: SUPERADMIN_EMAIL,
          password: "Lunchportalen123!",
        },
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

describe("Login runtime failure handling", () => {
  it("keeps login failures controlled on 503 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          rid: "rid_auth_down",
          error: "AUTH_UNAVAILABLE",
          message: "Innloggingstjenesten svarte ikke. Kontroller lokal runtime og prøv igjen.",
          status: 503,
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    (global as any).window.location = { assign: vi.fn() };

    const unhandledReasons: unknown[] = [];
    const onUnhandled = (event: Event) => {
      const rejectionEvent = event as PromiseRejectionEvent;
      unhandledReasons.push(rejectionEvent.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandled);

    const { container } = await renderLoginForm();
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

  it("keeps invalid credential failures controlled on 401 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          rid: "rid_invalid_login",
          error: "invalid_login",
          message: "Feil e-post eller passord.",
          status: 401,
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    (global as any).window.location = { assign: vi.fn() };

    const unhandledReasons: unknown[] = [];
    const onUnhandled = (event: Event) => {
      const rejectionEvent = event as PromiseRejectionEvent;
      unhandledReasons.push(rejectionEvent.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandled);

    const { container } = await renderLoginForm();
    const emailInput = container.querySelector('input[autocomplete="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    await act(async () => {
      setInputValue(emailInput, "wrong@example.com");
      setInputValue(passwordInput, "wrong-password");
    });

    await act(async () => {
      submit.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Feil e-post eller passord");
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toBe("Logg inn");
    expect((global as any).window.location.assign).not.toHaveBeenCalled();
    expect(unhandledReasons).toEqual([]);

    window.removeEventListener("unhandledrejection", onUnhandled);
  });
});
