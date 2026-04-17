import { describe, expect, it } from "vitest";

import { OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN } from "@/lib/cms/operationalWeekMenuPublishChain";

describe("operationalWeekMenuPublishChain", () => {
  it("har minst fire steg i operativ kjede", () => {
    expect(OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN.length).toBeGreaterThanOrEqual(4);
  });

  it("steg 2 peker på Studio-plassholder", () => {
    const studioStep = OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN.find((s) => s.step === 2);
    expect(studioStep?.actionHref).toBe("__STUDIO__");
  });
});
