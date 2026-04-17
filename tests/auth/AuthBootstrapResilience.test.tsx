/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { SupabasePublicConfigStatus } from "@/lib/config/env-public";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (_key: string) => null }),
}));

async function renderLoginForm(authRuntime: SupabasePublicConfigStatus) {
  const LoginForm = (await import("@/app/(auth)/login/LoginForm")).default;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(LoginForm, {
        authRuntime,
        localRuntimeCredentials: null,
      }),
    );
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Auth bootstrap resilience", () => {
  it("login form does not bootstrap auth network on mount", async () => {
    const fetchMock = vi.fn();
    (global as any).fetch = fetchMock;

    const { container } = await renderLoginForm({
      ok: true,
      url: "https://test.supabase.co",
      anonKey: "anon-key",
      issue: null,
      message: null,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).toContain("Logg inn");
  });

  it("invalid runtime config renders controlled state and disables submit", async () => {
    const fetchMock = vi.fn();
    (global as any).fetch = fetchMock;

    const { container } = await renderLoginForm({
      ok: false,
      url: null,
      anonKey: null,
      issue: "invalid_url",
      message: "Innlogging er ikke konfigurert fordi Supabase-URL er ugyldig i dette miljøet.",
    });

    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(container.textContent).toContain("Supabase-URL er ugyldig");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("central validator reports invalid Supabase URL without throwing", async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const origLocalRuntime = process.env.LP_LOCAL_CMS_RUNTIME;

    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
      process.env.LP_LOCAL_CMS_RUNTIME = "off";
      vi.resetModules();

      const { getSupabasePublicConfigStatus } = await import("@/lib/config/env-public");
      const status = getSupabasePublicConfigStatus();

      expect(status.ok).toBe(false);
      if (status.ok) {
        throw new Error("Expected invalid config status");
      }
      expect(status.issue).toBe("invalid_url");
      expect(status.message).toContain("Supabase-URL er ugyldig");
    } finally {
      vi.resetModules();
      if (origUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      if (origAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnon;
      if (origLocalRuntime === undefined) delete process.env.LP_LOCAL_CMS_RUNTIME;
      else process.env.LP_LOCAL_CMS_RUNTIME = origLocalRuntime;
    }
  });
});
