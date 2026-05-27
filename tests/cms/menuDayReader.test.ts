import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/sanity/client", () => ({
  sanity: {
    fetch: fetchMock,
  },
}));

describe("menuDay reader", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("projects menuDay into the runtime menu contract", async () => {
    fetchMock.mockResolvedValueOnce({
      _id: "menuDay-2026-04-20",
      _createdAt: "2026-04-25T08:57:30Z",
      _updatedAt: "2026-04-25T10:27:34Z",
      date: "2026-04-20",
      planTier: null,
      category: null,
      mealTitle: "Meksikansk suppe",
      title: "Meksikansk suppe",
      tier: "BUDGET",
      description: "Varm lunsjrett med tydelig meksikansk preg.",
      allergens: [],
      approvedForPublish: true,
      approvedAt: "2026-04-25T10:00:00Z",
      customerVisible: true,
      customerVisibleSetAt: "2026-04-25T10:15:00Z",
      isPublished: true,
    });

    const { getMenuForDate } = await import("@/lib/cms/menuDay");
    const menu = await getMenuForDate("2026-04-20");

    expect(menu).toEqual({
      _id: "menuDay-2026-04-20",
      _createdAt: "2026-04-25T08:57:30Z",
      _updatedAt: "2026-04-25T10:27:34Z",
      date: "2026-04-20",
      planTier: null,
      category: null,
      mealTitle: "Meksikansk suppe",
      title: "Meksikansk suppe",
      tier: "BUDGET",
      description: "Varm lunsjrett med tydelig meksikansk preg.",
      allergens: [],
      approvedForPublish: true,
      approvedAt: "2026-04-25T10:00:00Z",
      customerVisible: true,
      customerVisibleSetAt: "2026-04-25T10:15:00Z",
      isPublished: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('_type == "menuDay"'),
      { date: "2026-04-20" },
    );
    const query = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(query).toContain("planTier");
    expect(query).toContain("category");
    expect(query).toContain('"title": coalesce(mealTitle, mealRef->title)');
    expect(query).toContain('"allergens": coalesce(allergens, mealRef->allergens)');
    expect(query).toContain('"tier": costTier');
    expect(query).toContain('"isPublished": approvedForPublish == true && customerVisible == true');
    expect(query).not.toContain("isPublished == true");
  });
});
