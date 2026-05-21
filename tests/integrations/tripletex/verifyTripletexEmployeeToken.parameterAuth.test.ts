import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { verifyTripletexEmployeeToken } from "@/lib/integrations/tripletex/onboardingVerify";

describe("verifyTripletexEmployeeToken — parameter-auth uten singleton env", () => {
  const fetchMock = vi.fn();
  let savedEnv: Record<string, string | undefined> = {};

  const SINGLETON_KEYS = [
    "TRIPLETEX_COMPANY_ID",
    "TRIPLETEX_TOKEN",
    "TRIPLETEX_SESSION_TOKEN",
    "TRIPLETEX_EMPLOYEE_TOKEN",
  ] as const;

  const COMPANY_ID = 93310337;

  beforeEach(() => {
    savedEnv = {};
    for (const key of SINGLETON_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.TRIPLETEX_CONSUMER_TOKEN = "lp-consumer-token";

    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    for (const key of SINGLETON_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete process.env.TRIPLETEX_CONSUMER_TOKEN;
    vi.unstubAllGlobals();
  });

  test("full verify-flyt uten TRIPLETEX_COMPANY_ID i env", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: { token: "session-from-sandbox" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: { companyId: COMPANY_ID, companyName: "Smoke Test AS" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [], count: 0, fullResultSize: 0 }), { status: 200 }),
      );

    const result = await verifyTripletexEmployeeToken({
      employeeToken: "employee-token-smoke",
      expectedCompanyId: COMPANY_ID,
      consumerToken: "provider-consumer",
    });

    expect(result.auth.ok).toBe(true);
    expect(result.company_match.ok).toBe(true);
    expect(result.scope.ok).toBe(true);
    expect(result.all_passed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const whoAmIUrl = (fetchMock.mock.calls[1] as [string])[0];
    expect(whoAmIUrl).toContain("/token/session/%3EwhoAmI");
  });
});
