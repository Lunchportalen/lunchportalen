import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const createServerClientMock = vi.hoisted(() => vi.fn());
const getSupabasePublicConfigStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/config/env-public", () => ({
  getSupabasePublicConfigStatus: getSupabasePublicConfigStatusMock,
}));

vi.mock("@/lib/audit/log", () => ({
  auditLog: vi.fn(),
}));

function makePostReq(body: Record<string, unknown>) {
  return {
    nextUrl: new URL("http://localhost/api/auth/login"),
    headers: new Headers({ "content-type": "application/json" }),
    cookies: {
      getAll: () => [],
    },
    json: async () => body,
  } as any;
}

describe("POST /api/auth/login runtime failure handling", () => {
  beforeEach(() => {
    vi.resetModules();
    signInWithPasswordMock.mockReset();
    createServerClientMock.mockReset();
    getSupabasePublicConfigStatusMock.mockReset();

    getSupabasePublicConfigStatusMock.mockReturnValue({
      ok: true,
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      issue: null,
      message: null,
    });

    createServerClientMock.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    });
  });

  it("returns AUTH_BACKEND_UNREACHABLE when Supabase responds with a network error object", async () => {
    const networkError = new TypeError("fetch failed") as TypeError & {
      cause?: { code?: string };
    };
    networkError.cause = { code: "ENOTFOUND" };

    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: networkError,
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(
      makePostReq({
        email: "runtime@example.com",
        password: "secret123",
        next: "/backoffice/content",
      }),
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("AUTH_BACKEND_UNREACHABLE");
    expect(json.message).toContain("Innloggingstjenesten svarte ikke");
  });

  it("keeps credential failures on invalid_login", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(
      makePostReq({
        email: "wrong@example.com",
        password: "wrong-password",
      }),
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("invalid_login");
    expect(json.message).toBe("Feil e-post eller passord.");
  });
});
