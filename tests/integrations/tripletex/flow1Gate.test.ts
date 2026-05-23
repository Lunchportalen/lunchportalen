import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  Flow1DisabledError,
  __clearTripletexSessionCacheForTests,
  resolveTripletexAuth,
} from "@/lib/integrations/tripletex/client";

const LP_ENV = {
  TRIPLETEX_COMPANY_ID: "999",
  TRIPLETEX_TOKEN: "direct-session-token",
  TRIPLETEX_CONSUMER_TOKEN: "",
  TRIPLETEX_EMPLOYEE_TOKEN: "",
};

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: rpcMock,
  }),
}));

function applyLpEnv(extra?: Record<string, string>) {
  for (const [key, value] of Object.entries({ ...LP_ENV, ...extra })) {
    if (value) process.env[key] = value;
    else delete process.env[key];
  }
}

describe("Tripletex Flow 1 gate (DC-026)", () => {
  const origFlow1 = process.env.TRIPLETEX_FLOW_1_ENABLED;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    rpcMock.mockReset();
    __clearTripletexSessionCacheForTests();
    applyLpEnv();
    delete process.env.TRIPLETEX_FLOW_1_ENABLED;
  });

  afterEach(() => {
    __clearTripletexSessionCacheForTests();
    vi.unstubAllGlobals();
    if (origFlow1 === undefined) delete process.env.TRIPLETEX_FLOW_1_ENABLED;
    else process.env.TRIPLETEX_FLOW_1_ENABLED = origFlow1;
  });

  test("resolveTripletexAuth() throws Flow1DisabledError when flag is unset", async () => {
    await expect(resolveTripletexAuth()).rejects.toBeInstanceOf(Flow1DisabledError);
  });

  test("resolveTripletexAuth() succeeds when flag=true", async () => {
    process.env.TRIPLETEX_FLOW_1_ENABLED = "true";
    const auth = await resolveTripletexAuth();
    expect(auth).toEqual({ companyId: "999", token: "direct-session-token" });
  });

  test("Flow 2 provider path is unaffected when Flow 1 flag is unset", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        company_id_external: 42,
        consumer_token: "consumer-x",
        employee_token: "employee-y",
      },
      error: null,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: { token: "provider-session" } }), { status: 200 }),
    );

    const auth = await resolveTripletexAuth({ providerId: "provider-abc", env: "test" });
    expect(auth).toEqual({ companyId: "42", token: "provider-session" });
    expect(rpcMock).toHaveBeenCalledWith("lp_provider_load_tripletex_credentials", {
      p_provider_id: "provider-abc",
      p_env: "test",
    });
  });
});
