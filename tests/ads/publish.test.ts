import { afterEach, describe, expect, test } from "vitest";

import { publishCampaign } from "@/lib/ads/publish";
import { providers, registerAdsProvider } from "@/lib/ads/providers";

const base = {
  name: "Test",
  creative: "https://example.com/v.mp4",
  text: "Hook",
  cta: "SHOP_NOW",
  productId: "prod_1",
} as const;

describe("publishCampaign", () => {
  afterEach(() => {
    providers.length = 0;
  });

  test("uten godkjenning → pending_approval", async () => {
    const r = await publishCampaign({ ...base, budget: 50 }, false);
    expect(r).toEqual({ status: "pending_approval" });
  });

  test("budsjett 0 → blocked_no_budget", async () => {
    const r = await publishCampaign({ ...base, budget: 0 }, true);
    expect((r as { status: string }).status).toBe("blocked_no_budget");
  });

  test("uten creativ → blocked_no_creative", async () => {
    const r = await publishCampaign({ ...base, creative: null, budget: 10 }, true);
    expect((r as { status: string }).status).toBe("blocked_no_creative");
  });

  test("uten provider → no_provider", async () => {
    const r = await publishCampaign({ ...base, budget: 10 }, true);
    expect((r as { status: string }).status).toBe("no_provider");
  });

  test("med provider → createCampaign", async () => {
    registerAdsProvider({
      name: "test",
      createCampaign: async () => ({ status: "unit_ok" }),
    });
    const r = await publishCampaign({ ...base, budget: 10 }, true);
    expect((r as { status: string }).status).toBe("unit_ok");
  });
});
