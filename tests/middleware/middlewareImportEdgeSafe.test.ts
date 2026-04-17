import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: middleware → localDevBypassCookie → runtime must not transitively import
 * `lib/system/emails.ts`, whose `SYSTEM_EMAIL_ALLOWLIST` IIFE can throw on malformed env.
 */
describe("middleware import chain (edge-safe)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.SYSTEM_EMAIL_ALLOWLIST;
  });

  it("loads middleware when SYSTEM_EMAIL_ALLOWLIST would throw if emails.ts were imported at module init", async () => {
    vi.stubEnv("SYSTEM_EMAIL_ALLOWLIST", ",,,");
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "remote_backend");
    await expect(import("@/middleware")).resolves.toBeTruthy();
  });
});
