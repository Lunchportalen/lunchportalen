import { describe, expect, it, vi, afterEach } from "vitest";
import {
  decodeLocalDevAuthSessionPayload,
  hasLocalDevBypassSessionInCookieJar,
  LOCAL_DEV_AUTH_COOKIE,
} from "@/lib/auth/localDevBypassCookie";

describe("localDevBypassCookie (edge/node shared)", () => {
  afterEach(() => {
    delete process.env.LOCAL_DEV_AUTH_BYPASS;
    vi.unstubAllEnvs();
  });

  it("decodes payloads produced by Node base64url session encoding", () => {
    const session = {
      userId: "00000000-0000-4000-8000-000000000043",
      email: "Dev@Example.com",
      role: "superadmin" as const,
      company_id: null,
      location_id: null,
    };
    const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
    expect(decodeLocalDevAuthSessionPayload(encoded)).toEqual({
      ...session,
      email: "dev@example.com",
    });
  });

  it("hasLocalDevBypassSessionInCookieJar is false when bypass is disabled (even with a valid-looking cookie)", () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "remote_backend");
    const session = {
      userId: "00000000-0000-4000-8000-000000000043",
      email: "a@b.co",
      role: "superadmin" as const,
      company_id: null,
      location_id: null,
    };
    const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
    expect(
      hasLocalDevBypassSessionInCookieJar([{ name: LOCAL_DEV_AUTH_COOKIE, value: encoded }])
    ).toBe(false);
  });

  it("hasLocalDevBypassSessionInCookieJar is true when bypass is enabled and cookie validates", () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "remote_backend");
    vi.stubEnv("LOCAL_DEV_AUTH_BYPASS", "true");
    const session = {
      userId: "00000000-0000-4000-8000-000000000043",
      email: "a@b.co",
      role: "superadmin" as const,
      company_id: null,
      location_id: null,
    };
    const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
    expect(
      hasLocalDevBypassSessionInCookieJar([{ name: LOCAL_DEV_AUTH_COOKIE, value: encoded }])
    ).toBe(true);
  });

  it("hasLocalDevBypassSessionInCookieJar is false in production even if local CMS mode is on", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "local_provider");
    delete process.env.LOCAL_DEV_AUTH_BYPASS;
    const session = {
      userId: "00000000-0000-4000-8000-000000000043",
      email: "a@b.co",
      role: "superadmin" as const,
      company_id: null,
      location_id: null,
    };
    const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
    expect(
      hasLocalDevBypassSessionInCookieJar([{ name: LOCAL_DEV_AUTH_COOKIE, value: encoded }])
    ).toBe(false);
  });
});
