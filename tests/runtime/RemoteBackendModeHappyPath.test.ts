/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { REMOTE_BACKEND_HARNESS_EMAIL } from "@/lib/system/emails";

const createServerClientMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const updateUserByIdMock = vi.hoisted(() => vi.fn());
const insertAuditRowMock = vi.hoisted(() => vi.fn());
const contentPagesSelectMock = vi.hoisted(() => vi.fn());
const contentPagesUpsertMock = vi.hoisted(() => vi.fn());
const contentPagesUpdateMock = vi.hoisted(() => vi.fn());
const contentVariantsSelectMock = vi.hoisted(() => vi.fn());
const contentVariantsUpsertMock = vi.hoisted(() => vi.fn());
const contentVariantsDeleteMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdminConfig: () => true,
  supabaseAdmin: () => ({
    auth: {
      admin: {
        listUsers: listUsersMock,
        createUser: createUserMock,
        updateUserById: updateUserByIdMock,
      },
    },
    from: (table: string) => {
      if (table === "content_pages") {
        return {
          select: (...args: unknown[]) => contentPagesSelectMock(...args),
          upsert: (...args: unknown[]) => contentPagesUpsertMock(...args),
          update: (...args: unknown[]) => contentPagesUpdateMock(...args),
          insert: insertAuditRowMock,
        };
      }
      if (table === "content_page_variants") {
        return {
          select: (...args: unknown[]) => contentVariantsSelectMock(...args),
          upsert: (...args: unknown[]) => contentVariantsUpsertMock(...args),
          delete: (...args: unknown[]) => contentVariantsDeleteMock(...args),
          insert: insertAuditRowMock,
        };
      }
      return {
        insert: insertAuditRowMock,
      };
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "next" ? "/backoffice/content" : null) }),
}));

type NextRequestLike = Request & {
  nextUrl: URL;
  cookies: {
    getAll(): Array<{ name: string; value: string }>;
  };
};

const mountedRoots: Root[] = [];

function mkNextReq(url: string, init?: RequestInit): NextRequestLike {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("host")) {
    headers.set("host", new URL(url).host);
  }
  const req = new Request(url, { ...init, headers }) as NextRequestLike;
  req.nextUrl = new URL(url);
  req.cookies = {
    getAll: () => [],
  };
  return req;
}

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function renderLoginForm() {
  const LoginForm = (await import("@/app/(auth)/login/LoginForm")).default;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      React.createElement(LoginForm, {
        authRuntime: {
          ok: true,
          url: "https://remote.supabase.test",
          anonKey: "anon-key",
          issue: null,
          message: null,
        },
        localRuntimeCredentials: null,
      }),
    );
    await Promise.resolve();
  });

  return container;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("LP_CMS_RUNTIME_MODE", "remote_backend");
  vi.stubEnv("LP_REMOTE_BACKEND_AUTH_HARNESS", "1");
  vi.stubEnv("NODE_ENV", "test");

  listUsersMock.mockResolvedValue({ data: { users: [] }, error: null });
  createUserMock.mockResolvedValue({
    data: { user: { id: "remote_harness_user_1" } },
    error: null,
  });
  updateUserByIdMock.mockResolvedValue({ data: { user: { id: "remote_harness_user_1" } }, error: null });
  insertAuditRowMock.mockResolvedValue({ error: null });
  contentPagesUpsertMock.mockResolvedValue({ error: null });
  contentVariantsUpsertMock.mockResolvedValue({ error: null });

  contentPagesSelectMock.mockImplementation(() => {
    const state = {
      slug: "",
      eq(column: string, value: string) {
        if (column === "slug") state.slug = value;
        return this;
      },
      async then(resolve: (value: unknown) => unknown) {
        return resolve({ data: [], error: null });
      },
    };
    return state;
  });

  contentVariantsSelectMock.mockImplementation(() => {
    const state = {
      pageId: "",
      locale: "",
      environment: "",
      eq(column: string, value: string) {
        if (column === "page_id") state.pageId = value;
        if (column === "locale") state.locale = value;
        if (column === "environment") state.environment = value;
        return this;
      },
      async maybeSingle() {
        return { data: null, error: null };
      },
    };
    return state;
  });

  contentPagesUpdateMock.mockImplementation(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  contentVariantsDeleteMock.mockImplementation(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));

  createServerClientMock.mockImplementation((_url: string, _key: string, opts?: { cookies?: { setAll?: (v: unknown) => void } }) => ({
    auth: {
      signInWithPassword: vi.fn(async () => {
        opts?.cookies?.setAll?.([
          {
            name: "sb-remote-auth-token.0",
            value: "eyJhbGciOiJIUzI1NiJ9.remote",
            options: { path: "/" },
          },
        ]);
        return {
          data: {
            session: {
              access_token: "remote-access-token",
              refresh_token: "remote-refresh-token",
              expires_at: null,
              expires_in: null,
              token_type: "bearer",
            },
            user: {
              id: "remote_harness_user_1",
              email: REMOTE_BACKEND_HARNESS_EMAIL,
            },
          },
          error: null,
        };
      }),
    },
  }));
});

afterEach(async () => {
  await act(async () => {
    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.unmount();
    }
    await Promise.resolve();
  });
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Remote backend mode happy path", () => {
  test("keeps runtime explicit remote_backend and exposes only remote harness credentials", async () => {
    const runtime = await import("@/lib/localRuntime/runtime");
    const localRuntimeAuth = await import("@/lib/auth/localRuntimeAuth");
    const remoteHarness = await import("@/lib/auth/remoteBackendAuthHarness");

    expect(runtime.getCmsRuntimeStatus()).toMatchObject({
      mode: "remote_backend",
      explicit: true,
      requiresRemoteBackend: true,
    });
    expect(localRuntimeAuth.getLocalRuntimeAuthState()).toBeNull();
    expect(remoteHarness.getRemoteBackendAuthHarnessCredentials()).toEqual({
      email: REMOTE_BACKEND_HARNESS_EMAIL,
      password: "Lunchportalen123!",
    });
  });

  test("provisions a deterministic remote backend harness user through the canonical route", async () => {
    const { POST } = await import("@/app/api/auth/remote-backend-harness/route");

    const res = await POST(
      mkNextReq("http://localhost:3300/api/auth/remote-backend-harness", {
        method: "POST",
      }) as unknown as import("next/server").NextRequest,
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({
      mode: "remote_backend",
      email: REMOTE_BACKEND_HARNESS_EMAIL,
      next: "/backoffice/content",
      userId: "remote_harness_user_1",
    });
    expect(createUserMock).toHaveBeenCalledTimes(1);
  });

  test("uses normal login API against Supabase cookies without local_provider fallback", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(
      mkNextReq("http://localhost:3300/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: REMOTE_BACKEND_HARNESS_EMAIL,
          password: "Lunchportalen123!",
          next: "/backoffice/content",
        }),
      }) as unknown as import("next/server").NextRequest,
    );

    const json = await readJson(res);
    const setCookie = String(res.headers.get("set-cookie") ?? "");

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.next).toBe("/backoffice/content");
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(setCookie).toContain("sb-remote-auth-token");
    expect(setCookie).not.toContain("lp_local_dev_auth=");
  });

  test("keeps the normal login form and does not expose local runtime hints in remote mode", async () => {
    const container = await renderLoginForm();

    expect(container.querySelector('input[autocomplete="email"]')).toBeTruthy();
    expect(container.querySelector('input[autocomplete="current-password"]')).toBeTruthy();
    expect(container.textContent).toContain("Logg inn");
    expect(container.textContent).not.toContain("Lokal runtime-konto");
  });
});
