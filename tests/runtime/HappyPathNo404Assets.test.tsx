/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

import { cmsPageDetailQueryString } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.preview";
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

describe("Happy path no 404 requests", () => {
  beforeEach(() => {
    vi.resetModules();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    document.body.innerHTML = "";
    searchParamsState.next = "/backoffice/content";
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  });

  test("canonical detail query string stays on nb/preview", () => {
    expect(cmsPageDetailQueryString()).toBe("locale=nb&environment=preview");
    expect(cmsPageDetailQueryString()).not.toContain("locale=en");
  });

  test("login form happy path only uses canonical auth endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, rid: "rid_happy_path", next: "/backoffice/content" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);
    (global as any).window.location = { assign: vi.fn() };

    const { container, root } = await renderLoginForm({
      email: SUPERADMIN_EMAIL,
      password: "Lunchportalen123!",
    });

    const emailInput = container.querySelector('input[autocomplete="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    await act(async () => {
      setInputValue(emailInput, SUPERADMIN_EMAIL);
      setInputValue(passwordInput, "Lunchportalen123!");
    });

    await act(async () => {
      submit.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(["/api/auth/login"]);
    expect((global as any).window.location.assign).toHaveBeenCalledWith(
      "/api/auth/post-login?next=%2Fbackoffice%2Fcontent",
    );

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  test("editor detail loader stays pinned to the canonical nb/preview query builder", async () => {
    const path = await import("path");
    const fs = await import("fs");
    const sourcePath = path.join(
      process.cwd(),
      "app",
      "(backoffice)",
      "backoffice",
      "content",
      "_components",
      "useContentWorkspaceData.ts",
    );
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain("cmsPageDetailQueryString(");
    expect(source).toMatch(/cmsPageDetailQueryString\(\s*loc\s*\)/);
    expect(source).toContain("/api/backoffice/content/pages/${encodeURIComponent(selectedId)}?");
    expect(source).toContain("normalizeEditorLocale(editorLocale)");
    expect(source).not.toContain("locale=en&environment=preview");
  });
});
