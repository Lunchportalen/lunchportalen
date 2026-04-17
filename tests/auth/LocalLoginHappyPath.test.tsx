/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { getLocalRuntimeLoginCredentials } from "@/lib/auth/localRuntimeAuth";
import { SUPERADMIN_EMAIL } from "@/lib/system/emails";

const searchParamsState = {
  next: "/backoffice/content" as string | null,
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "next" ? searchParamsState.next : null) }),
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

const originalLocalRuntimeFlag = process.env.LP_LOCAL_CMS_RUNTIME;

describe("Local login happy path", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LP_LOCAL_CMS_RUNTIME = "1";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    document.body.innerHTML = "";
    searchParamsState.next = "/backoffice/content";
    if (originalLocalRuntimeFlag === undefined) delete process.env.LP_LOCAL_CMS_RUNTIME;
    else process.env.LP_LOCAL_CMS_RUNTIME = originalLocalRuntimeFlag;
  });

  it("submits the normal login form with canonical seeded credentials and redirects to post-login", async () => {
    const credentials = getLocalRuntimeLoginCredentials();
    expect(credentials).toEqual({
      email: SUPERADMIN_EMAIL,
      password: "Lunchportalen123!",
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, rid: "rid_local", next: "/backoffice/content" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);
    (global as any).window.location = { assign: vi.fn() };

    const { container } = await renderLoginForm(credentials);
    const emailInput = container.querySelector('input[autocomplete="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(container.textContent).toContain("Lokal runtime-konto");
    expect(container.textContent).toContain(credentials.email);
    expect(container.textContent).toContain(credentials.password);

    await act(async () => {
      setInputValue(emailInput, credentials.email);
      setInputValue(passwordInput, credentials.password);
    });

    await act(async () => {
      submit.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = fetchMock.mock.calls[0];
    expect(String(fetchUrl)).toContain("/api/auth/login");
    expect(fetchOptions.method).toBe("POST");
    expect(JSON.parse(fetchOptions.body)).toEqual({
      email: credentials.email,
      password: credentials.password,
      next: "/backoffice/content",
    });
    expect((global as any).window.location.assign).toHaveBeenCalledWith(
      "/api/auth/post-login?next=%2Fbackoffice%2Fcontent",
    );
  });
});
