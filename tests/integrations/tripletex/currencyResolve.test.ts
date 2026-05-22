import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  __clearTripletexCurrencyCacheForTests,
  resolveTripletexCurrencyId,
} from "@/lib/integrations/tripletex/client";

describe("resolveTripletexCurrencyId", () => {
  const fetchMock = vi.fn();
  const auth = { companyId: "93310337", token: "session_token_abc" };

  beforeEach(() => {
    vi.stubEnv("TRIPLETEX_BASE_URL", "https://api-test.tripletex.tech/v2");
    __clearTripletexCurrencyCacheForTests();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          value: {
            values: [
              { id: 1, code: "NOK", name: "Norske kroner" },
              { id: 2, code: "EUR", name: "Euro" },
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

  test("mapper ISO 4217-kode til Tripletex currency id", async () => {
    const id = await resolveTripletexCurrencyId("nok", auth);
    expect(id).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("cache-hit: andre lookup uten ekstra /currency-fetch", async () => {
    await resolveTripletexCurrencyId("NOK", auth);
    await resolveTripletexCurrencyId("EUR", auth);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("ukjent valuta gir tydelig feil", async () => {
    await expect(resolveTripletexCurrencyId("XXX", auth)).rejects.toMatchObject({
      code: "TRIPLETEX_CURRENCY_NOT_FOUND",
      message: "Currency 'XXX' not found in Tripletex /currency",
    });
  });
});
