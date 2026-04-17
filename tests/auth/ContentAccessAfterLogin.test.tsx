/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { allowNextForRole } from "@/lib/auth/role";
import { getLocalRuntimeLoginCredentials } from "@/lib/auth/localRuntimeAuth";
import ContentPageRoute from "@/app/(backoffice)/backoffice/content/page";
import { SUPERADMIN_EMAIL } from "@/lib/system/emails";

(global as any).React = React;

const searchParamsState = {
  next: "/backoffice/content" as string | null,
};

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "next" ? searchParamsState.next : null) }),
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  redirect: vi.fn(),
}));

vi.mock("@/app/(backoffice)/backoffice/content/_workspace/ContentEditor", () => ({
  default: ({ nodeId }: { nodeId: string }) =>
    React.createElement("div", { "data-testid": "content-editor" }, `Editor ${nodeId}`),
}));

async function renderLoginForm(
  localRuntimeCredentials: { email: string; password: string } | null = null,
) {
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
  process.env.LP_LOCAL_CMS_RUNTIME = "1";
  pushMock.mockReset();
  replaceMock.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          items: [],
        },
      }),
    })),
  );
});

const originalLocalRuntimeFlag = process.env.LP_LOCAL_CMS_RUNTIME;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  searchParamsState.next = "/backoffice/content";
  if (originalLocalRuntimeFlag === undefined) delete process.env.LP_LOCAL_CMS_RUNTIME;
  else process.env.LP_LOCAL_CMS_RUNTIME = originalLocalRuntimeFlag;
});

describe("Content access after login", () => {
  it("superadmin allow-list keeps /backoffice/content intact", () => {
    expect(allowNextForRole("superadmin", "/backoffice/content")).toBe("/backoffice/content");
  });

  it("successful login path redirects through post-login with backoffice next", async () => {
    const localRuntimeCredentials = getLocalRuntimeLoginCredentials();
    expect(localRuntimeCredentials).toEqual({
      email: SUPERADMIN_EMAIL,
      password: "Lunchportalen123!",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, rid: "rid_login", next: "/backoffice/content" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    (global as any).fetch = fetchMock;
    (global as any).window.location = { assign: vi.fn() };

    const { container } = await renderLoginForm(localRuntimeCredentials);
    const emailInput = container.querySelector('input[autocomplete="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    await act(async () => {
      setInputValue(emailInput, localRuntimeCredentials.email);
      setInputValue(passwordInput, localRuntimeCredentials.password);
    });

    await act(async () => {
      submit.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((global as any).window.location.assign).toHaveBeenCalledWith(
      "/api/auth/post-login?next=%2Fbackoffice%2Fcontent",
    );
  });

  it("local runtime keeps normal login form and removes bypass button", async () => {
    const localRuntimeCredentials = getLocalRuntimeLoginCredentials();
    expect(localRuntimeCredentials).toEqual({
      email: SUPERADMIN_EMAIL,
      password: "Lunchportalen123!",
    });
    const { container } = await renderLoginForm(localRuntimeCredentials);

    expect(container.textContent).toContain("Lokal runtime-konto");
    expect(container.textContent).toContain(localRuntimeCredentials.email);
    expect(container.textContent).toContain(localRuntimeCredentials.password);
    const bypass = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Åpne lokal utviklingsøkt",
    );
    expect(bypass).toBeUndefined();
  });

  it("backoffice content overview route renders without crashing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ContentPageRoute));
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Åpner redigeringsvisning"]')).toBeTruthy();
    document.body.removeChild(container);
  });

  it("content editor route mounts for UUID ids", async () => {
    const ContentIdPage = (await import("@/app/(backoffice)/backoffice/content/[id]/page")).default;
    const uuid = "11111111-1111-4111-8111-111111111111";
    const node = await ContentIdPage({
      params: Promise.resolve({ id: uuid }),
      searchParams: Promise.resolve({}),
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(node);
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="content-editor"]')?.textContent).toContain(uuid);
    document.body.removeChild(container);
  });
});
