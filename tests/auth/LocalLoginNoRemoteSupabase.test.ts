import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_DEV_AUTH_ACCESS_TOKEN,
  LOCAL_DEV_AUTH_COOKIE,
  LOCAL_DEV_AUTH_REFRESH_TOKEN,
} from "@/lib/auth/devBypass";
import { SUPERADMIN_EMAIL } from "@/lib/system/emails";

const createServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
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

const originalLocalRuntimeFlag = process.env.LP_LOCAL_CMS_RUNTIME;

describe("Local login route bypasses remote Supabase", () => {
  beforeEach(() => {
    vi.resetModules();
    createServerClientMock.mockReset();
    process.env.LP_LOCAL_CMS_RUNTIME = "1";
  });

  afterEach(() => {
    if (originalLocalRuntimeFlag === undefined) delete process.env.LP_LOCAL_CMS_RUNTIME;
    else process.env.LP_LOCAL_CMS_RUNTIME = originalLocalRuntimeFlag;
  });

  it("uses the canonical local auth source and never calls createServerClient on seeded happy path", async () => {
    const { POST } = await import("@/app/api/auth/login/route");

    const res = await POST(
      makePostReq({
        email: SUPERADMIN_EMAIL,
        password: "Lunchportalen123!",
        next: "/backoffice/content",
      }),
    );

    expect(res.status).toBe(200);
    expect(createServerClientMock).not.toHaveBeenCalled();

    expect(res.cookies.get("sb-access-token")?.value).toBe(LOCAL_DEV_AUTH_ACCESS_TOKEN);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe(LOCAL_DEV_AUTH_REFRESH_TOKEN);
    expect(res.cookies.get(LOCAL_DEV_AUTH_COOKIE)?.value).toBeTruthy();

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.next).toBe("/backoffice/content");
    expect(json.data.session.access_token).toBe(LOCAL_DEV_AUTH_ACCESS_TOKEN);
    expect(json.data.session.refresh_token).toBe(LOCAL_DEV_AUTH_REFRESH_TOKEN);
  });
});
