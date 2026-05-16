import { describe, expect, it, vi } from "vitest";
import type { SanityClient } from "@sanity/client";

import { fetchMealIdeaBank, getCurrentNorwegianSeason } from "@/lib/menu-publish/mealIdeaBankQuery";

/** Mid-month noon UTC — kalendermåned samsvarer med Oslo-måned for alle måneder 1–12. */
function utcNoon(year: number, month1Based: number): Date {
  return new Date(Date.UTC(year, month1Based - 1, 15, 12, 0, 0));
}

describe("getCurrentNorwegianSeason", () => {
  const Y = 2026;
  const cases: Array<[month: number, expected: ReturnType<typeof getCurrentNorwegianSeason>]> = [
    [1, "vinter"],
    [2, "vinter"],
    [3, "vår"],
    [4, "vår"],
    [5, "vår"],
    [6, "sommer"],
    [7, "sommer"],
    [8, "sommer"],
    [9, "høst"],
    [10, "høst"],
    [11, "høst"],
    [12, "vinter"],
  ];

  it.each(cases)("måned %i → %s", (month, expected) => {
    expect(getCurrentNorwegianSeason(utcNoon(Y, month))).toBe(expected);
  });
});

describe("fetchMealIdeaBank sesong-GROQ", () => {
  it("inkluderer helår og $currentSeason (norsk)", async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    await fetchMealIdeaBank({ fetch } as unknown as SanityClient, "BASIS", false);
    const q = String(fetch.mock.calls[0]?.[0] ?? "");
    expect(q).toContain('"helår" in season');
    expect(q).toContain("$currentSeason in season");
    expect(q).toContain("!defined(season)");
    expect(q).toContain("count(season) == 0");
  });

  it("sender norsk currentSeason fra klokke (vår i mai)", async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    const mai = utcNoon(2026, 5);
    await fetchMealIdeaBank({ fetch } as unknown as SanityClient, "BASIS", false, mai);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("$currentSeason in season"),
      expect.objectContaining({ currentSeason: "vår", tier: "BASIS" }),
    );
  });

  it("sommer i juli", async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    await fetchMealIdeaBank({ fetch } as unknown as SanityClient, "ENTERPRISE", true, utcNoon(2026, 7));
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ currentSeason: "sommer" }),
    );
  });
});
