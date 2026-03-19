import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { middleware } from "@/middleware";
import { getSupabasePublicConfig } from "@/lib/config/env";

vi.mock("@/lib/config/env", () => ({
  getSupabasePublicConfig: vi.fn(),
}));

// We don't construct a real NextRequest (not available in Vitest by default).
// nextUrl.clone() must return a URL instance so NextResponse.redirect(u) receives a valid URL.
function makeRequest(path: string): any {
  const url = new URL(`https://example.com${path}`);
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
      getAll() {
        return [];
      },
    },
  };
}

describe("middleware redirect safety (platform core)", () => {
  beforeEach(() => {
    vi.mocked(getSupabasePublicConfig).mockReturnValue({
      url: "http://supabase.test",
      anonKey: "anon_test_key",
    });
  });

  it("redirects unauthenticated users on protected routes to /login with next param", async () => {
    vi.mock("@supabase/ssr", () => ({
      createServerClient: () => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }),
    }));

    const req = makeRequest("/admin?tab=users");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(303);
    const location = res.headers.get("location");
    expect(location).toMatch(/^https:\/\/example\.com\/login\?/);
    expect(location).toContain("next=%2Fadmin%3Ftab%3Dusers");
  });

  it("redirects unauthenticated /backoffice to /login with next param", async () => {
    vi.mock("@supabase/ssr", () => ({
      createServerClient: () => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }),
    }));

    const req = makeRequest("/backoffice/content");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(303);
    const location = res.headers.get("location");
    expect(location).toMatch(/^https:\/\/example\.com\/login\?/);
    expect(location).toContain("next=");
    expect(decodeURIComponent(location ?? "")).toContain("/backoffice/content");
  });

  it("fails closed to /status when Supabase config is unavailable on protected routes", async () => {
    vi.mocked(getSupabasePublicConfig).mockImplementationOnce(() => {
      throw new Error("Missing Supabase public env");
    });

    const req = makeRequest("/admin");
    const res = await middleware(req);

    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(303);
    const location = res.headers.get("location");
    expect(location).toBe("https://example.com/status?state=blocked&code=MISSING_SUPABASE_ENV");
  });
});


