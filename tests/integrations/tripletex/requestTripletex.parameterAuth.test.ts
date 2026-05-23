import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  TripletexClientError,
  __clearTripletexSessionCacheForTests,
  requestTripletex,
} from "@/lib/integrations/tripletex/client";

describe("requestTripletex — parameter-auth uten singleton env", () => {
  const fetchMock = vi.fn();
  let savedEnv: Record<string, string | undefined> = {};

  const SINGLETON_KEYS = [
    "TRIPLETEX_COMPANY_ID",
    "TRIPLETEX_TOKEN",
    "TRIPLETEX_SESSION_TOKEN",
    "TRIPLETEX_CONSUMER_TOKEN",
    "TRIPLETEX_EMPLOYEE_TOKEN",
    "TRIPLETEX_FLOW_1_ENABLED",
  ] as const;

  beforeEach(() => {
    savedEnv = {};
    for (const key of SINGLETON_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }

    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    __clearTripletexSessionCacheForTests();
  });

  afterEach(() => {
    for (const key of SINGLETON_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    __clearTripletexSessionCacheForTests();
    vi.unstubAllGlobals();
  });

  test("explicit auth passerer uten TRIPLETEX_COMPANY_ID i env", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          value: { companyId: 93310337, companyName: "Smoke Test AS" },
        }),
        { status: 200 },
      ),
    );

    const auth = { companyId: "93310337", token: "session_xyz" };
    const result = await requestTripletex({ method: "GET", path: "/whoAmI" }, { auth });

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/whoAmI");
    expect(init.headers).toMatchObject({
      authorization: `Basic ${Buffer.from("93310337:session_xyz", "utf8").toString("base64")}`,
    });
  });

  test("uten auth + uten env → TRIPLETEX_CONFIG_MISSING", async () => {
    process.env.TRIPLETEX_FLOW_1_ENABLED = "true";
    await expect(requestTripletex({ method: "GET", path: "/whoAmI" })).rejects.toMatchObject({
      code: "TRIPLETEX_CONFIG_MISSING",
      message: expect.stringContaining("TRIPLETEX_COMPANY_ID"),
    } satisfies Partial<TripletexClientError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
