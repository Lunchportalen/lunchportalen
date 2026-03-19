import { describe, it, expect } from "vitest";
import { validateSystemRuntimeEnv } from "@/lib/env/system";
import { getSupabasePublicConfig, getSanityReadConfig } from "@/lib/config/env";

describe("env validation (platform core)", () => {
  it("validateSystemRuntimeEnv reports missing keys when SYSTEM_MOTOR_SECRET is absent", () => {
    const original = process.env["SYSTEM_MOTOR_SECRET"];
    // Ensure key is absent for this assertion
    // eslint-disable-next-line no-restricted-syntax
    delete process.env["SYSTEM_MOTOR_SECRET"];

    const report = validateSystemRuntimeEnv();
    if (original !== undefined) {
      process.env["SYSTEM_MOTOR_SECRET"] = original;
    }

    expect(report.ok).toBe(false);
    if (report.ok === false) expect(report.missing).toContain("SYSTEM_MOTOR_SECRET");
  });

  it("getSupabasePublicConfig throws if public Supabase env is missing", () => {
    const origNodeEnv = process.env["NODE_ENV"];
    const origVitest = process.env["VITEST"];
    const origUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const origAnon = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

    Object.assign(process.env, { NODE_ENV: "production" });
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
  });

  it("getSanityReadConfig throws if Sanity env is missing", () => {
    const origProject = process.env["NEXT_PUBLIC_SANITY_PROJECT_ID"];
    const origDataset = process.env["NEXT_PUBLIC_SANITY_DATASET"];

    // eslint-disable-next-line no-restricted-syntax
    delete process.env["NEXT_PUBLIC_SANITY_PROJECT_ID"];
    // eslint-disable-next-line no-restricted-syntax
    delete process.env["NEXT_PUBLIC_SANITY_DATASET"];

    expect(() => getSanityReadConfig()).toThrow(/Missing env: NEXT_PUBLIC_SANITY_PROJECT_ID/);

    if (origProject !== undefined) process.env["NEXT_PUBLIC_SANITY_PROJECT_ID"] = origProject;
    if (origDataset !== undefined) process.env["NEXT_PUBLIC_SANITY_DATASET"] = origDataset;
  });
});


