/**
 * Login form submit flow: proves real request path and loading state.
 * - Submit sends signInWithPassword then POST /api/auth/post-login (mocked).
 * - Loading appears during request; invalid credentials show error.
 * No auth redesign; no fake success.
 */
/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

const mockSignIn = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: { signInWithPassword: mockSignIn },
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (_key: string) => null }),
}));

// Env required by LoginForm makeSupabase()
const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const origAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key";
});
afterEach(() => {
  if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
  if (origAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnon;
  vi.clearAllMocks();
});

async function renderLoginForm() {
  const LoginForm = (await import("@/app/(auth)/login/LoginForm")).default;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(LoginForm));
    await Promise.resolve();
  });
  return { container, root };
}

function getEmailInput(container: HTMLElement) {
  const labels = container.querySelectorAll("label");
  for (const l of labels) {
    if (l.textContent?.includes("E-post")) {
      const id = l.getAttribute("for");
      if (id) return container.querySelector(`#${id}`) as HTMLInputElement;
      return l.nextElementSibling as HTMLInputElement;
    }
  }
  return container.querySelector('input[autoComplete="email"]') as HTMLInputElement;
}
function getPasswordInput(container: HTMLElement) {
  const labels = container.querySelectorAll("label");
  for (const l of labels) {
    if (l.textContent?.includes("Passord")) {
      const id = l.getAttribute("for");
      if (id) return container.querySelector(`#${id}`) as HTMLInputElement;
      return l.nextElementSibling as HTMLInputElement;
    }
  }
  return container.querySelector('input[autoComplete="current-password"]') as HTMLInputElement;
}
function getSubmitButton(container: HTMLElement) {
  return container.querySelector('button[type="button"]') as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Login form submit flow", () => {
  it("submit sends signInWithPassword then POST /api/auth/post-login (real request path)", async () => {
    mockSignIn.mockResolvedValue({
      data: { session: { access_token: "tk", refresh_token: "rt" } },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 303 }));
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

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "secret123",
    });
    expect(fetchMock).toHaveBeenCalled();
    const [fetchUrl, fetchOpts] = fetchMock.mock.calls[0];
    expect(String(fetchUrl)).toContain("/api/auth/post-login");
    expect(fetchOpts?.method).toBe("POST");
    const body = JSON.parse(fetchOpts?.body ?? "{}");
    expect(body.access_token).toBe("tk");
    expect(body.refresh_token).toBe("rt");
    expect(body.next).toBe("/week");
  });

  it("loading state is shown during request (button disabled and text)", async () => {
    let resolveSignIn: (v: any) => void;
    const signInPromise = new Promise<any>((r) => { resolveSignIn = r; });
    mockSignIn.mockReturnValue(signInPromise);
    (global as any).fetch = vi.fn().mockResolvedValue(new Response(null, { status: 303 }));
    (global as any).window.location = { assign: vi.fn() };

    const { container } = await renderLoginForm();
    const emailInput = getEmailInput(container);
    const passwordInput = getPasswordInput(container);
    const button = getSubmitButton(container);

    await act(async () => {
      setInputValue(emailInput, "u@t.no");
      setInputValue(passwordInput, "p");
    });

    const clickPromise = act(async () => {
      button.click();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });
    const btn = getSubmitButton(container);
    expect(btn?.disabled).toBe(true);
    expect(btn?.textContent?.trim()).toContain("Logger inn");

    resolveSignIn!({ data: { session: { access_token: "x", refresh_token: "y" } }, error: null });
    await clickPromise;
  });

  it("invalid credentials show error and no POST to post-login", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });
    const fetchMock = vi.fn();
    (global as any).fetch = fetchMock;

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

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "wrong@example.com",
      password: "wrong",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const errDiv = container.querySelector(".border-red-200");
    expect(errDiv).toBeTruthy();
    expect(errDiv?.textContent).toContain("Invalid login credentials");
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

    expect(mockSignIn).not.toHaveBeenCalled();
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

  it("one click triggers exactly one signIn and one fetch (no duplicate request)", async () => {
    mockSignIn.mockResolvedValue({
      data: { session: { access_token: "tk", refresh_token: "rt" } },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 303 }));
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

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/auth/post-login");
  });
});
