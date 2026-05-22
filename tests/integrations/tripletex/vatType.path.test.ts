import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ensureProviderVatCode,
  TRIPLETEX_VAT_TYPE_PATH,
} from "@/lib/integrations/tripletex/client";

describe("ensureProviderVatCode — Tripletex vatType path", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("TRIPLETEX_BASE_URL", "https://api-test.tripletex.tech/v2");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          value: {
            values: [{ id: 3, percentage: 25, name: "Outgoing 25%" }],
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

  test("kaller /ledger/vatType (ikke top-level /vatType)", async () => {
    const admin = {
      from: (table: string) => {
        if (table !== "billing_tax_codes") {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "MVA_25", rate: 0.25, tripletex_vat_code: null },
                error: null,
              }),
            }),
          }),
        };
      },
    };

    await ensureProviderVatCode({
      admin,
      providerId: "742c7d6c-3632-4362-a665-da0e415aab8c",
      taxCodeId: "MVA_25",
      env: "test",
      request: { auth: { companyId: "93310337", token: "session_xyz" } },
    });

    expect(TRIPLETEX_VAT_TYPE_PATH).toBe("/ledger/vatType");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/ledger/vatType");
    expect(url).not.toMatch(/\/v2\/vatType(?:\?|$)/);
  });
});
