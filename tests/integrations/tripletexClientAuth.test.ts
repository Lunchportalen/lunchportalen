import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  TripletexClientError,
  __clearTripletexSessionCacheForTests,
  resolveTripletexAuth,
} from "@/lib/integrations/tripletex/client";

const SESSION_TTL_MS = 6 * 24 * 60 * 60 * 1000;

const LP_ENV = {
  TRIPLETEX_COMPANY_ID: "999",
  TRIPLETEX_TOKEN: "direct-session-token",
  TRIPLETEX_CONSUMER_TOKEN: "",
  TRIPLETEX_EMPLOYEE_TOKEN: "",
};

function applyLpEnv(extra?: Record<string, string>) {
  for (const [key, value] of Object.entries({ ...LP_ENV, ...extra })) {
    if (value) process.env[key] = value;
    else delete process.env[key];
  }
}

describe("tripletexClientAuth (TPT-A-1)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    __clearTripletexSessionCacheForTests();
    applyLpEnv();
  });

  afterEach(() => {
    __clearTripletexSessionCacheForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("backward-compat: resolveTripletexAuth() uten args gir stabil shape og cache-hit", async () => {
    const first = await resolveTripletexAuth();
    const second = await resolveTripletexAuth();

    expect(first).toEqual({ companyId: "999", token: "direct-session-token" });
    expect(second).toEqual(first);
    expect(second).toBe(first);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("cache-keying: env test vs prod gir separate cache-entries", async () => {
    const testAuth = await resolveTripletexAuth({ env: "test" });
    const prodAuth = await resolveTripletexAuth({ env: "prod" });

    expect(testAuth).toEqual(prodAuth);
    expect(testAuth).not.toBe(prodAuth);
  });

  test("cache-keying: lp vs providerId er separate keys (provider kaster)", async () => {
    const lpAuth = await resolveTripletexAuth();

    await expect(resolveTripletexAuth({ providerId: "abc-123" })).rejects.toMatchObject({
      kind: "PROVIDER_CREDENTIALS_NOT_IMPLEMENTED",
    });

    const lpAgain = await resolveTripletexAuth();
    expect(lpAgain).toBe(lpAuth);
  });

  test("provider-stub: TripletexClientError med sporbar providerId", async () => {
    let caught: TripletexClientError | null = null;
    try {
      await resolveTripletexAuth({ providerId: "abc-123", env: "test" });
    } catch (error) {
      caught = error as TripletexClientError;
    }

    expect(caught).toBeInstanceOf(TripletexClientError);
    expect(caught?.kind).toBe("PROVIDER_CREDENTIALS_NOT_IMPLEMENTED");
    expect(caught?.code).toBe("PROVIDER_CREDENTIALS_NOT_IMPLEMENTED");
    expect(caught?.message).toContain("abc-123");
    expect(caught?.message).toContain("TPT-B-1");
  });

  test("provider-stub: feilede provider-kall populerer ikke cache", async () => {
    const rejectProvider = () =>
      resolveTripletexAuth({ providerId: "abc-123" }).catch((e) => e);

    const first = await rejectProvider();
    const second = await rejectProvider();

    expect(first).toBeInstanceOf(TripletexClientError);
    expect(second).toBeInstanceOf(TripletexClientError);
    expect(first).not.toBe(second);
  });

  test("TTL: session regenereres etter SESSION_TTL_MS", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));

    applyLpEnv({
      TRIPLETEX_TOKEN: "",
      TRIPLETEX_CONSUMER_TOKEN: "consumer",
      TRIPLETEX_EMPLOYEE_TOKEN: "employee",
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: { token: "session-a" } }), { status: 200 }),
    );

    const first = await resolveTripletexAuth();
    expect(first.token).toBe("session-a");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SESSION_TTL_MS + 1);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: { token: "session-b" } }), { status: 200 }),
    );

    const second = await resolveTripletexAuth();
    expect(second.token).toBe("session-b");
    expect(second).not.toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
