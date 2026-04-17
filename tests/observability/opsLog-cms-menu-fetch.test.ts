import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Closeout 6: Sanity menykall som feiler skal emitere strukturert opsLog (ikke bare stille tom map).
 */
describe("getMenusByMealTypes — observability on Sanity failure", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("logger cms.menu.fetch_failed når sanity.fetch kaster", async () => {
    const opsSpy = vi.fn();
    vi.doMock("@/lib/ops/log", () => ({
      opsLog: opsSpy,
    }));
    vi.doMock("@/lib/sanity/client", () => ({
      sanity: {
        fetch: vi.fn().mockRejectedValue(new Error("GROQ timeout")),
      },
    }));

    const { getMenusByMealTypesWithFetchStatus } = await import("@/lib/cms/getMenusByMealTypes");
    const out = await getMenusByMealTypesWithFetchStatus(["varmmat"]);

    expect(out.fetchFailed).toBe(true);
    expect(out.map.size).toBe(0);
    expect(opsSpy).toHaveBeenCalledTimes(1);
    expect(opsSpy.mock.calls[0]?.[0]).toBe("cms.menu.fetch_failed");
    expect(opsSpy.mock.calls[0]?.[1]).toMatchObject({
      surface: "getMenusByMealTypes",
      mealTypeKeyCount: 1,
      detail: "GROQ timeout",
    });
  });
});
