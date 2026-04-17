import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

function resetRuntimeEnv() {
  delete process.env.LP_CMS_RUNTIME_MODE;
  delete process.env.LOCAL_CMS_RUNTIME_MODE;
  delete process.env.LP_LOCAL_CMS_RUNTIME;
  delete process.env.LOCAL_DEV_CONTENT_RESERVE;
}

describe.sequential("Local provider startup noise", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    resetRuntimeEnv();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/ensureRpc");
    vi.resetModules();
    vi.unstubAllEnvs();
    resetRuntimeEnv();
  });

  test("local_provider skips remote RPC bootstrap during instrumentation startup", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "local_provider");
    const ensureRpcReady = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/supabase/ensureRpc", () => ({ ensureRpcReady }));

    const { initSupabaseServerHooks } = await import("@/lib/supabase/init");
    await initSupabaseServerHooks();

    expect(ensureRpcReady).not.toHaveBeenCalled();
  });

  test("reserve mode also skips remote RPC bootstrap", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "reserve");
    const ensureRpcReady = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/supabase/ensureRpc", () => ({ ensureRpcReady }));

    const { initSupabaseServerHooks } = await import("@/lib/supabase/init");
    await initSupabaseServerHooks();

    expect(ensureRpcReady).not.toHaveBeenCalled();
  });

  test("remote_backend keeps RPC bootstrap enabled", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "remote_backend");
    const ensureRpcReady = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/supabase/ensureRpc", () => ({ ensureRpcReady }));

    const { initSupabaseServerHooks } = await import("@/lib/supabase/init");
    await initSupabaseServerHooks();

    expect(ensureRpcReady).toHaveBeenCalledTimes(1);
  });
});
