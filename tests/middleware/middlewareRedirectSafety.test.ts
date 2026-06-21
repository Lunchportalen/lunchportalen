import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { LOCAL_DEV_AUTH_COOKIE } from "@/lib/auth/localDevBypassCookie";
import { LP_LOCALE_COOKIE } from "@/lib/i18n/middlewareLocale";
import { hasSupabaseSsrAuthCookieInJar } from "@/lib/supabase/ssrSessionCookies";

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: async (req: { cookies: { getAll: () => Array<{ name: string; value: string }> } }, headers: Headers) => ({
    response: NextResponse.next({ request: { headers } }),
    hasSupabaseSessionCookie: hasSupabaseSsrAuthCookieInJar(req.cookies.getAll()),
  }),
}));

import { middleware } from "@/middleware";

// We don't construct a real NextRequest (not available in Vitest by default).
// nextUrl.clone() must return a URL instance so NextResponse.redirect(u) receives a valid URL.
const SSR_SESSION_COOKIE = "sb-exampleproject-auth-token.0";

function makeRequest(
  path: string,
  opts?: { withSsrSession?: boolean; devBypassPayload?: string; localeCookie?: string }
): any {
  const url = new URL(`https://example.com${path}`);
  const withSsrSession = opts?.withSsrSession;
  const devBypassPayload = opts?.devBypassPayload;
  const localeCookie = opts?.localeCookie;
  return {
    nextUrl: {
      pathname: url.pathname,
      searchParams: url.searchParams,
      href: url.toString(),
      clone() {
        return new URL(url.toString());
      },
    },
    headers: new Headers(),
    cookies: {
      get(name: string) {
        if (name === SSR_SESSION_COOKIE && withSsrSession) return { value: "x" };
        if (name === LOCAL_DEV_AUTH_COOKIE && devBypassPayload) return { value: devBypassPayload };
        if (name === LP_LOCALE_COOKIE && localeCookie) return { value: localeCookie };
        return undefined;
      },
      getAll() {
        const all: Array<{ name: string; value: string }> = [];
        if (withSsrSession) all.push({ name: SSR_SESSION_COOKIE, value: "x" });
        if (devBypassPayload) all.push({ name: LOCAL_DEV_AUTH_COOKIE, value: devBypassPayload });
        if (localeCookie) all.push({ name: LP_LOCALE_COOKIE, value: localeCookie });
        return all;
      },
    },
  };
}

function authOutcome(res: NextResponse) {
  return {
    status: res.status,
    location: res.headers.get("location"),
    mwUser: res.headers.get("x-lp-mw-user"),
    mwRedirect: res.headers.get("x-lp-mw-redirect"),
    mwApiAuth: res.headers.get("x-lp-mw-api-auth"),
    mwBypass: res.headers.get("x-lp-mw-bypass"),
  };
}

describe("middleware redirect safety (platform core)", () => {
  it("redirects users without Supabase SSR session cookie on protected routes to /login with next param", async () => {
    const req = makeRequest("/admin?tab=users");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(303);
    const location = res.headers.get("location");
    expect(location).toMatch(/^https:\/\/example\.com\/login\?/);
    expect(location).toContain("next=%2Fadmin%3Ftab%3Dusers");
  });

  it("redirects missing token /backoffice to /login with next param", async () => {
    const req = makeRequest("/backoffice/content");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(303);
    const location = res.headers.get("location");
    expect(location).toMatch(/^https:\/\/example\.com\/login\?/);
    expect(location).toContain("next=");
    expect(decodeURIComponent(location ?? "")).toContain("/backoffice/content");
  });

  it("redirects users without session on /leverandor to /login with next param", async () => {
    const req = makeRequest("/leverandor/dashboard");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(303);
    const location = res.headers.get("location");
    expect(location).toMatch(/^https:\/\/example\.com\/login\?/);
    expect(location).toContain("next=%2Fleverandor%2Fdashboard");
  });

  it("allows /leverandor when Supabase SSR auth cookie jar is present", async () => {
    const req = makeRequest("/leverandor", { withSsrSession: true });
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-lp-mw-user")).toBe("1");
  });

  it("allows protected route when Supabase SSR auth cookie jar is present", async () => {
    const req = makeRequest("/admin", { withSsrSession: true });
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-lp-mw-user")).toBe("1");
  });

  it("returns JSON 401 for non-allowlisted /api/* without session", async () => {
    const req = makeRequest("/api/orders");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(401);
    expect(res.headers.get("x-lp-mw-api-auth")).toBe("401");
  });

  it("allows allowlisted anon /api/onboarding/complete without session", async () => {
    const req = makeRequest("/api/onboarding/complete");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-lp-mw-bypass")).toBe("allowlist");
  });
});

describe("middleware ↔ getAuthContext local dev bypass", () => {
  beforeEach(() => {
    // Canonical mode wins over legacy flags — keeps bypass tests deterministic vs other suites on the same worker.
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "remote_backend");
  });

  const validDevBypassPayload = Buffer.from(
    JSON.stringify({
      userId: "00000000-0000-4000-8000-000000000043",
      email: "dev@example.com",
      role: "superadmin",
      company_id: null,
      location_id: null,
    }),
    "utf8"
  ).toString("base64url");

  afterEach(() => {
    delete process.env.LOCAL_DEV_AUTH_BYPASS;
    vi.unstubAllEnvs();
  });

  it("allows protected route with valid lp_local_dev_auth when LOCAL_DEV_AUTH_BYPASS=true (no SSR jar)", async () => {
    vi.stubEnv("LOCAL_DEV_AUTH_BYPASS", "true");
    const req = makeRequest("/admin", { devBypassPayload: validDevBypassPayload });
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-lp-mw-user")).toBe("1");
    expect(res.headers.get("x-lp-mw-dev-bypass")).toBe("1");
  });

  it("does not treat dev bypass cookie as auth in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEV_AUTH_BYPASS", "true");
    const req = makeRequest("/admin", { devBypassPayload: validDevBypassPayload });
    const res = await middleware(req);

    expect(res.status).toBe(303);
    expect(res.headers.get("x-lp-mw-dev-bypass")).toBeNull();
  });

  it("does not treat local CMS runtime + dev cookie as auth in production (mis-set LP_CMS_RUNTIME_MODE)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "local_provider");
    delete process.env.LOCAL_DEV_AUTH_BYPASS;
    const req = makeRequest("/admin", { devBypassPayload: validDevBypassPayload });
    const res = await middleware(req);

    expect(res.status).toBe(303);
    expect(res.headers.get("x-lp-mw-dev-bypass")).toBeNull();
  });

  it("redirects when bypass is enabled but dev session cookie is invalid", async () => {
    vi.stubEnv("LOCAL_DEV_AUTH_BYPASS", "true");
    const req = makeRequest("/admin", { devBypassPayload: "@@@not-valid@@@" });
    const res = await middleware(req);

    expect(res.status).toBe(303);
  });
});

describe("middleware locale header does not alter auth/login redirect", () => {
  const unauthenticatedProtectedPaths = [
    "/admin?tab=users",
    "/week",
    "/backoffice/content",
    "/leverandor/dashboard",
    "/orders",
  ];

  it.each(unauthenticatedProtectedPaths)("login redirect identical with and without lp_locale for %s", async (path) => {
    const baseline = authOutcome(await middleware(makeRequest(path)));
    const withEn = authOutcome(await middleware(makeRequest(path, { localeCookie: "en" })));
    const withNb = authOutcome(await middleware(makeRequest(path, { localeCookie: "nb" })));
    const withInvalid = authOutcome(await middleware(makeRequest(path, { localeCookie: "xx" })));

    expect(withEn).toEqual(baseline);
    expect(withNb).toEqual(baseline);
    expect(withInvalid).toEqual(baseline);
    expect(baseline.status).toBe(303);
    expect(baseline.location).toMatch(/^https:\/\/example\.com\/login\?/);
    expect(baseline.mwRedirect).toBe("login");
  });

  it("API 401 gate identical with and without lp_locale cookie", async () => {
    const baseline = authOutcome(await middleware(makeRequest("/api/orders")));
    const withEn = authOutcome(await middleware(makeRequest("/api/orders", { localeCookie: "en" })));

    expect(withEn).toEqual(baseline);
    expect(baseline.status).toBe(401);
    expect(baseline.mwApiAuth).toBe("401");
  });

  it("allowlisted API bypass identical with lp_locale cookie", async () => {
    const baseline = authOutcome(await middleware(makeRequest("/api/onboarding/complete")));
    const withEn = authOutcome(await middleware(makeRequest("/api/onboarding/complete", { localeCookie: "en" })));

    expect(withEn).toEqual(baseline);
    expect(baseline.status).toBe(200);
    expect(baseline.mwBypass).toBe("allowlist");
  });

  it("authenticated protected route gate identical with lp_locale cookie", async () => {
    const baseline = authOutcome(await middleware(makeRequest("/admin", { withSsrSession: true })));
    const withEn = authOutcome(await middleware(makeRequest("/admin", { withSsrSession: true, localeCookie: "en" })));

    expect(withEn).toEqual(baseline);
    expect(baseline.status).toBe(200);
    expect(baseline.mwUser).toBe("1");
  });
});
