import { describe, expect, test } from "vitest";

import {
  MELHUS_PROVIDER_SANITY_ID,
  MELHUS_PROVIDER_SLUG,
  melhusProviderReference,
} from "@/lib/cms/providerSanityConstants";

describe("providerSanityConstants", () => {
  test("Melhus id matches Patch 5 seed", () => {
    expect(MELHUS_PROVIDER_SANITY_ID).toBe("11111111-1111-1111-1111-111111111111");
    expect(MELHUS_PROVIDER_SLUG).toBe("melhus-catering");
  });

  test("melhusProviderReference shape", () => {
    expect(melhusProviderReference()).toEqual({
      _type: "reference",
      _ref: MELHUS_PROVIDER_SANITY_ID,
    });
  });
});
