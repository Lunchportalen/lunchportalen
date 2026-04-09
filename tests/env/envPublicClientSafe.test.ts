import { describe, it, expect } from "vitest";
import { getSupabasePublicConfig } from "@/lib/config/env-public";

/**
 * Client-safe config: must be importable and usable without server-only.
 * Protects against client chain (e.g. lib/supabase/client.ts) importing lib/config/env.ts.
 */
describe("env-public (client-safe Supabase config)", () => {
  it("getSupabasePublicConfig returns config in test env when vars missing", () => {
    const cfg = getSupabasePublicConfig();
    expect(cfg).toEqual({
      url: expect.any(String),
      anonKey: expect.any(String),
    });
    expect(cfg.url.length).toBeGreaterThan(0);
    expect(cfg.anonKey.length).toBeGreaterThan(0);
  });

  it("getSupabasePublicConfig throws in production when NEXT_PUBLIC_SUPABASE_URL missing", () => {
    const origNodeEnv = process.env["NODE_ENV"];
    const origVitest = process.env["VITEST"];
    const origUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const origAnon = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    const origLpCms = process.env["LP_CMS_RUNTIME_MODE"];

    Object.assign(process.env, { NODE_ENV: "production", LP_CMS_RUNTIME_MODE: "remote_backend" });
    // eslint-disable-next-line no-restricted-syntax
    delete process.env["VITEST"];
    // eslint-disable-next-line no-restricted-syntax
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    // eslint-disable-next-line no-restricted-syntax
    delete process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

    expect(() => getSupabasePublicConfig()).toThrow(/Missing env: NEXT_PUBLIC_SUPABASE_URL/);

    if (origNodeEnv !== undefined) Object.assign(process.env, { NODE_ENV: origNodeEnv });
    if (origVitest !== undefined) process.env["VITEST"] = origVitest;
    if (origUrl !== undefined) process.env["NEXT_PUBLIC_SUPABASE_URL"] = origUrl;
    if (origAnon !== undefined) process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = origAnon;
    if (origLpCms !== undefined) process.env["LP_CMS_RUNTIME_MODE"] = origLpCms;
    else delete process.env["LP_CMS_RUNTIME_MODE"];
  });
});
