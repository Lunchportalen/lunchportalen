import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  __clearTripletexCountryCacheForTests,
  buildTripletexCustomerCreateBody,
  ensureCompanyCustomer,
} from "@/lib/integrations/tripletex/client";

describe("ensureCompanyCustomer — Tripletex CustomerDTO payload", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("TRIPLETEX_BASE_URL", "https://api-test.tripletex.tech/v2");
    __clearTripletexCountryCacheForTests();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/country")) {
        return new Response(
          JSON.stringify({
            value: {
              values: [{ id: 161, name: "Norge", isoAlpha2Code: "NO" }],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/customer") && init?.method === "POST") {
        return new Response(JSON.stringify({ value: { id: 88001, name: "FX Co A" } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ message: "unexpected url" }), { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("buildTripletexCustomerCreateBody bruker postalAddress.country som nested {id}", () => {
    const body = buildTripletexCustomerCreateBody({
      name: "FX Co A 5f4c2527",
      organizationNumber: "398825767",
      countryId: 161,
      billingAddress: "Gate 1",
      billingPostcode: "7030",
      billingCity: "Trondheim",
    });

    expect(body.postalAddress).toEqual({
      addressLine1: "Gate 1",
      postalCode: "7030",
      city: "Trondheim",
      country: { id: 161 },
    });
    expect((body.postalAddress as { country: unknown }).country).not.toBe("NO");
  });

  test("POST /customer sender country: {id}, ikke flat ISO-streng", async () => {
    const admin = {
      from: (table: string) => {
        if (table === "tripletex_customers") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: async () => ({ error: null }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    await ensureCompanyCustomer({
      admin,
      providerId: "742c7d6c-3632-4362-a665-da0e415aab8c",
      env: "test",
      company: {
        id: "90634f78-d481-4e5f-b841-ac06a5bb2ac5",
        orgnr: "398825767",
        legal_name: "FX Co A 5f4c2527",
        billing_email: null,
        billing_address: "Gate 1",
        billing_postcode: "7030",
        billing_city: "Trondheim",
        billing_country: "NO",
        ehf_enabled: false,
        ehf_endpoint: null,
      },
      request: { auth: { companyId: "93310337", token: "session_xyz" } },
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/customer") && (init as RequestInit)?.method === "POST",
    );
    expect(postCall).toBeTruthy();

    const body = JSON.parse(String((postCall?.[1] as RequestInit).body));
    expect(body.postalAddress.country).toEqual({ id: 161 });
    expect(body.postalAddress.country).not.toBe("NO");
  });
});
