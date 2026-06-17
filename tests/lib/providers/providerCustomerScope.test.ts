import { describe, expect, it } from "vitest";

import { isProviderSelfCustomer } from "@/lib/providers/providerCustomerScope";

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const PETTERSEN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("isProviderSelfCustomer", () => {
  const melhusProvider = {
    id: MELHUS_PROVIDER_ID,
    name: "Melhus Catering AS",
    orgNumber: "123456789",
  };

  it("matcher samme id som provider", () => {
    expect(
      isProviderSelfCustomer(
        { id: MELHUS_PROVIDER_ID, name: "Melhus Catering AS", orgnr: "123456789" },
        melhusProvider,
      ),
    ).toBe(true);
  });

  it("matcher samme orgnr som provider", () => {
    expect(
      isProviderSelfCustomer(
        { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Melhus Catering AS", orgnr: "123456789" },
        melhusProvider,
      ),
    ).toBe(true);
  });

  it("matcher samme navn som provider", () => {
    expect(
      isProviderSelfCustomer(
        { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Melhus Catering AS", orgnr: null },
        melhusProvider,
      ),
    ).toBe(true);
  });

  it("ekskluderer ikke ekte lunsjkunde", () => {
    expect(
      isProviderSelfCustomer(
        { id: PETTERSEN_ID, name: "Pettersen&Co", orgnr: "987654321" },
        melhusProvider,
      ),
    ).toBe(false);
  });
});
