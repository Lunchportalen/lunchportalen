import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/lib/sanity/client", () => ({
  sanity: { fetch: (...args: unknown[]) => fetchMock(...args) },
}));

vi.mock("@/lib/cms/menuDayProviderFilter", () => ({
  menuDayProviderGroqClause: () => ({ clause: "true", params: {}, legacyUnscoped: true }),
}));

describe("getProductPlan includesWarm → varmmat", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("appends varmmat when includesWarm is true and allowedMeals omits it", async () => {
    fetchMock.mockResolvedValueOnce({
      name: "basis",
      price: 79,
      allowedMeals: ["paasmurt", "salat"],
      includesWarm: true,
      rules: { allowDailyVariation: false },
    });

    const { getProductPlan } = await import("@/lib/cms/getProductPlan");
    const plan = await getProductPlan("basis");

    expect(plan?.allowedMeals).toEqual(["paasmurt", "salat", "varmmat"]);
  });

  test("does not append varmmat when includesWarm is false", async () => {
    fetchMock.mockResolvedValueOnce({
      name: "luxus",
      price: 119,
      allowedMeals: ["paasmurt", "salat", "sushi"],
      includesWarm: false,
      rules: { allowDailyVariation: true },
    });

    const { getProductPlan } = await import("@/lib/cms/getProductPlan");
    const plan = await getProductPlan("luxus");

    expect(plan?.allowedMeals).toEqual(["paasmurt", "salat", "sushi"]);
  });

  test("defaults includesWarm to true when field is missing", async () => {
    fetchMock.mockResolvedValueOnce({
      name: "enterprise",
      price: 149,
      allowedMeals: ["paasmurt", "salat", "sushi", "pokebowl", "thaimat"],
      rules: { allowDailyVariation: true },
    });

    const { getProductPlan } = await import("@/lib/cms/getProductPlan");
    const plan = await getProductPlan("enterprise");

    expect(plan?.allowedMeals).toContain("varmmat");
  });
});
