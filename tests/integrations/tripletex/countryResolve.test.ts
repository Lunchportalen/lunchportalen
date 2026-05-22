import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  __clearTripletexCountryCacheForTests,
  resolveTripletexCountryId,
} from "@/lib/integrations/tripletex/client";

describe("resolveTripletexCountryId", () => {
  const fetchMock = vi.fn();
  const auth = { companyId: "93310337", token: "session_token_abc" };

  beforeEach(() => {
    vi.stubEnv("TRIPLETEX_BASE_URL", "https://api-test.tripletex.tech/v2");
    __clearTripletexCountryCacheForTests();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          value: {
            values: [
              { id: 161, name: "Norge", isoAlpha2Code: "NO" },
              { id: 752, name: "Sverige", isoAlpha2Code: "SE" },
            ],
          },
        }),
        { status: 200 },
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("mapper ISO alpha-2 til Tripletex country id", async () => {
    const id = await resolveTripletexCountryId("no", auth);
    expect(id).toBe(161);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("cache-hit: andre lookup uten ekstra /country-fetch", async () => {
    await resolveTripletexCountryId("NO", auth);
    await resolveTripletexCountryId("SE", auth);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("ukjent ISO gir tydelig feil", async () => {
    await expect(resolveTripletexCountryId("XX", auth)).rejects.toMatchObject({
      code: "TRIPLETEX_COUNTRY_NOT_FOUND",
      message: expect.stringContaining("Country ISO 'XX' not found"),
    });
  });
});
