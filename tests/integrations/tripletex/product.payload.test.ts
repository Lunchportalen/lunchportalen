import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  __clearTripletexProductUnitCacheForTests,
  buildTripletexProductCreateBody,
  ensureProviderProduct,
} from "@/lib/integrations/tripletex/client";

describe("ensureProviderProduct — Tripletex ProductDTO payload", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("TRIPLETEX_BASE_URL", "https://api-test.tripletex.tech/v2");
    __clearTripletexProductUnitCacheForTests();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/product/unit")) {
        return new Response(
          JSON.stringify({
            value: {
              values: [{ id: 2237422, name: "Stykk", nameShort: "stk", nameShortEN: "each" }],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/ledger/vatType")) {
        return new Response(
          JSON.stringify({
            value: { values: [{ id: 11, percentage: 15 }] },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/product") && init?.method === "POST") {
        return new Response(JSON.stringify({ value: { id: 9001, name: "Firmalunsj BASIS" } }), {
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

  test("buildTripletexProductCreateBody bruker productUnit og vatType som nested {id}", () => {
    const body = buildTripletexProductCreateBody({
      name: "Firmalunsj BASIS",
      number: "LP-BASIS",
      productUnitId: 2237422,
      vatTypeId: 11,
    });

    expect(body).toEqual({
      name: "Firmalunsj BASIS",
      number: "LP-BASIS",
      productUnit: { id: 2237422 },
      isStockItem: false,
      vatType: { id: 11 },
    });
    expect(body).not.toHaveProperty("unit");
    expect(body).not.toHaveProperty("vatTypeId");
  });

  test("POST /product sender productUnit: {id}, ikke flat unit", async () => {
    const admin = {
      from: (table: string) => {
        if (table === "provider_tripletex_products") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            upsert: async () => ({ error: null }),
          };
        }
        if (table === "billing_products") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    tier: "BASIS",
                    product_name: "Firmalunsj BASIS",
                    revenue_account: null,
                    tax_code_id: "MVA_15",
                    unit: "stk",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "billing_tax_codes") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "MVA_15", rate: 0.15, tripletex_vat_code: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    await ensureProviderProduct({
      admin,
      providerId: "742c7d6c-3632-4362-a665-da0e415aab8c",
      tier: "BASIS",
      env: "test",
      request: { auth: { companyId: "93310337", token: "session_xyz" } },
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/product") && (init as RequestInit)?.method === "POST",
    );
    expect(postCall).toBeTruthy();

    const init = postCall?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));

    expect(body.productUnit).toEqual({ id: 2237422 });
    expect(body.vatType).toEqual({ id: 11 });
    expect(body).not.toHaveProperty("unit");
    expect(body).not.toHaveProperty("vatTypeId");
  });
});
