/** @vitest-environment jsdom */

import React, { act } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { SUPERADMIN_EMAIL } from "@/lib/system/emails";

// React 19 test environment hint: suppress spurious act-environment warnings.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const searchParamsState = {
  next: null as string | null,
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "next" ? searchParamsState.next : null) }),
}));

afterEach(() => {
  searchParamsState.next = null;
  vi.clearAllMocks();
});

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

function getEmailInput(container: HTMLElement) {
  return container.querySelector('input[autoComplete="email"]') as HTMLInputElement;
}
function getPasswordInput(container: HTMLElement) {
  return container.querySelector('input[autoComplete="current-password"]') as HTMLInputElement;
}
function getSubmitButton(container: HTMLElement) {
  return container.querySelector('button[type="submit"]') as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Login form submit flow", () => {
  it("submit sends POST /api/auth/login then redirects via /api/auth/post-login", async () => {
    searchParamsState.next = "/backoffice/content";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, rid: "rid_login", next: "/backoffice/content" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const assignMock = vi.fn();
    (global as any).fetch = fetchMock;
    (global as any).window.location = { assign: assignMock };

    const { container } = await renderLoginForm();
    const emailInput = getEmailInput(container);
    const passwordInput = getPasswordInput(container);
    const button = getSubmitButton(container);
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(button).toBeTruthy();

    await act(async () => {
      setInputValue(emailInput, "test@example.com");
      setInputValue(passwordInput, "secret123");
    });

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
    const [fetchUrl, fetchOpts] = fetchMock.mock.calls[0];
    expect(String(fetchUrl)).toContain("/api/auth/login");
    expect(fetchOpts?.method).toBe("POST");
    const body = JSON.parse(fetchOpts?.body ?? "{}");
    expect(body.email).toBe("test@example.com");
    expect(body.password).toBe("secret123");
    expect(body.next).toBe("/backoffice/content");
    expect(assignMock).toHaveBeenCalledWith("/api/auth/post-login?next=%2Fbackoffice%2Fcontent");
  });

  it("loading state is shown during request (button disabled and text)", async () => {
    let resolveFetch: (v: any) => void;
    const fetchPromise = new Promise<any>((r) => { resolveFetch = r; });
    (global as any).fetch = vi.fn().mockReturnValue(fetchPromise);
    (global as any).window.location = { assign: vi.fn() };

    const { container } = await renderLoginForm();
    const emailInput = getEmailInput(container);
    const passwordInput = getPasswordInput(container);
    const button = getSubmitButton(container);

    await act(async () => {
      setInputValue(emailInput, "u@t.no");
      setInputValue(passwordInput, "p");
    });

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    const btn = getSubmitButton(container);
    expect(btn?.disabled).toBe(true);
    expect(btn?.textContent?.trim()).toContain("Logger inn");

    await act(async () => {
      resolveFetch!(
        new Response(JSON.stringify({ ok: true, rid: "rid_login", next: "/week" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      await Promise.resolve();
    });
  });

  it("invalid credentials show error and no redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          rid: "rid_login",
          error: "invalid_login",
          message: "Feil e-post eller passord.",
          status: 401,
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    (global as any).fetch = fetchMock;
    (global as any).window.location = { assign: vi.fn() };

    const { container } = await renderLoginForm();
    const emailInput = getEmailInput(container);
    const passwordInput = getPasswordInput(container);
    const button = getSubmitButton(container);

    await act(async () => {
      setInputValue(emailInput, "wrong@example.com");
      setInputValue(passwordInput, "wrong");
    });

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((global as any).window.location.assign).not.toHaveBeenCalled();
    const errDiv = container.querySelector(".border-red-200");
    expect(errDiv).toBeTruthy();
    expect(errDiv?.textContent).toContain("Feil e-post eller passord");
  });

  it("empty email/password shows validation error and no network", async () => {
    const fetchMock = vi.fn();
    (global as any).fetch = fetchMock;

    const { container } = await renderLoginForm();
    const button = getSubmitButton(container);

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const errDiv = container.querySelector(".border-red-200");
    expect(errDiv?.textContent).toContain("Fyll inn e-post og passord");

    await act(async () => {
      await Promise.resolve();
    });
    const btnAfter = getSubmitButton(container);
    expect(btnAfter?.disabled).toBe(false);
    expect(btnAfter?.textContent?.trim()).toContain("Logg inn");
  });

  it("one click triggers exactly one login fetch (no duplicate request)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, rid: "rid_login", next: "/week" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    (global as any).fetch = fetchMock;
    (global as any).window.location = { assign: vi.fn() };

    const { container } = await renderLoginForm();
    const emailInput = getEmailInput(container);
    const passwordInput = getPasswordInput(container);
    const button = getSubmitButton(container);

    await act(async () => {
      setInputValue(emailInput, "one@test.no");
      setInputValue(passwordInput, "pass");
    });

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/auth/login");
  });
});
