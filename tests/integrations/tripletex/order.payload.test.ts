import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  __clearTripletexCurrencyCacheForTests,
  buildTripletexOrderCreateBody,
  createInvoice,
} from "@/lib/integrations/tripletex/client";

describe("createInvoice — Tripletex OrderDTO payload", () => {
  const fetchMock = vi.fn();
  const auth = { companyId: "93310337", token: "session_token_abc" };

  beforeEach(() => {
    vi.stubEnv("TRIPLETEX_BASE_URL", "https://api-test.tripletex.tech/v2");
    __clearTripletexCurrencyCacheForTests();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/currency")) {
        return new Response(
          JSON.stringify({
            value: {
              values: [{ id: 1, code: "NOK", name: "Norske kroner" }],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/order") && init?.method === "POST") {
        return new Response(JSON.stringify({ value: { id: 501001 } }), { status: 200 });
      }
      if (url.includes("/order/501001/:invoice") && init?.method === "PUT") {
        return new Response(JSON.stringify({ value: { id: 501002 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: "unexpected url" }), { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("buildTripletexOrderCreateBody bruker currency som nested {id}", () => {
    const body = buildTripletexOrderCreateBody({
      customerId: "88001",
      currencyId: 1,
      orderDate: "2026-05-22",
      uniqueRef: "lp-inv-001",
      orderLines: [{ product: { id: "9001" }, count: 1 }],
    });

    expect(body.currency).toEqual({ id: 1 });
    expect(body.currency).not.toBe("NOK");
    expect(body.customer).toEqual({ id: "88001" });
  });

  test("POST /order sender currency: {id}, ikke flat ISO-streng", async () => {
    await createInvoice({
      uniqueRef: "lp-inv-001",
      customerId: "88001",
      invoiceLine: {
        quantity: 1,
        unit_price: 100,
        product_name: "Firmalunsj BASIS",
        tripletex_vat_code: "11",
        currency: "NOK",
      },
      productId: "9001",
      request: { auth },
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/order") && (init as RequestInit)?.method === "POST",
    );
    expect(postCall).toBeTruthy();

    const body = JSON.parse(String((postCall?.[1] as RequestInit).body));
    expect(body.currency).toEqual({ id: 1 });
    expect(body.currency).not.toBe("NOK");
  });
});
