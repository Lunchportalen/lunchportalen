import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

function resetRuntimeEnv() {
  delete process.env.LP_CMS_RUNTIME_MODE;
  delete process.env.LOCAL_CMS_RUNTIME_MODE;
  delete process.env.LP_LOCAL_CMS_RUNTIME;
  delete process.env.LOCAL_DEV_CONTENT_RESERVE;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

describe.sequential("CMS runtime mode single truth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    resetRuntimeEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRuntimeEnv();
  });

  test("defaults to explicit remote_backend when no runtime flag is set", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const runtime = await import("@/lib/localRuntime/runtime");
    const reserve = await import("@/lib/cms/contentLocalDevReserve");

    expect(runtime.getCmsRuntimeStatus()).toMatchObject({
      mode: "remote_backend",
      explicit: false,
      requiresRemoteBackend: true,
    });
    expect(runtime.isLocalCmsRuntimeEnabled()).toBe(false);
    expect(reserve.isLocalDevContentReserveEnabled()).toBe(false);
  });

  test("local_provider mode is the only mode that enables local auth/runtime config", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "local_provider");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");

    const runtime = await import("@/lib/localRuntime/runtime");
    const auth = await import("@/lib/auth/localRuntimeAuth");
    const envPublic = await import("@/lib/config/env-public");

    expect(runtime.getCmsRuntimeStatus()).toMatchObject({
      mode: "local_provider",
      explicit: true,
      usesLocalProvider: true,
      requiresRemoteBackend: false,
    });
    expect(runtime.isLocalCmsRuntimeEnabled()).toBe(true);
    expect(auth.getLocalRuntimeAuthState()).not.toBeNull();

    const config = envPublic.getSupabasePublicConfigStatus();
    expect(config.ok).toBe(true);
    expect(config.url).toBe(runtime.LOCAL_CMS_RUNTIME_SUPABASE_URL);
    expect(config.issue).toBeNull();
  });

  test("reserve mode is explicit and does not masquerade as local_provider", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "reserve");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");

    const runtime = await import("@/lib/localRuntime/runtime");
    const reserve = await import("@/lib/cms/contentLocalDevReserve");
    const auth = await import("@/lib/auth/localRuntimeAuth");
    const envPublic = await import("@/lib/config/env-public");

    expect(runtime.getCmsRuntimeStatus()).toMatchObject({
      mode: "reserve",
      explicit: true,
      usesReserve: true,
      requiresRemoteBackend: false,
    });
    expect(runtime.isLocalCmsRuntimeEnabled()).toBe(false);
    expect(reserve.isLocalDevContentReserveEnabled()).toBe(true);
    expect(auth.getLocalRuntimeAuthState()).toBeNull();

    const config = envPublic.getSupabasePublicConfigStatus();
    expect(config.ok).toBe(false);
    expect(config.issue).toBe("invalid_url");
  });
});
