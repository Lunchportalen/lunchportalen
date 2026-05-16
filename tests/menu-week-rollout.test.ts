import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SanityClient } from "@sanity/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Meal } from "@/lib/menu-publish/generateWeekMenu";
import { fetchMealIdeaBank } from "@/lib/menu-publish/mealIdeaBankQuery";
import { runMenuWeekRollout, validateRolloutWeekMondayIso } from "@/lib/menu-publish/runMenuWeekRollout";

function diverseMealsFixture(prefix: string): Meal[] {
  const out: Meal[] = [];
  const n = { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 };
  const styles = ["international", "nordic", "asian", "italian", "mediterranean", "french"] as const;
  const tagsRot = ["chicken", "beef", "pork", "lamb", "turkey", "duck"] as const;
  for (let i = 0; i < 80; i += 1) {
    out.push({
      _id: `${prefix}-std-${i}`,
      title: `Rett ${prefix} std ${i}`,
      description: `Besk ${i}`,
      tags: [tagsRot[i % tagsRot.length]],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      nutritionScore: 7,
      estimatedCostPerPortion: 70,
      allergens: [],
      isActive: true,
      kitchenStyle: styles[i % styles.length],
    });
  }
  for (let i = 0; i < 4; i += 1) {
    out.push({
      _id: `${prefix}-fish-${i}`,
      title: `Fisk ${prefix} ${i}`,
      tags: ["fish"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      estimatedCostPerPortion: 72,
      isFishDish: true,
      isActive: true,
      kitchenStyle: styles[(i + 1) % styles.length],
    });
  }
  for (let i = 0; i < 4; i += 1) {
    out.push({
      _id: `${prefix}-soup-${i}`,
      title: `Suppe ${prefix} ${i}`,
      tags: ["chicken"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      isSoup: true,
      isActive: true,
      kitchenStyle: styles[(i + 2) % styles.length],
    });
  }
  for (let i = 0; i < 6; i += 1) {
    out.push({
      _id: `${prefix}-veg-${i}`,
      title: `Veg ${prefix} ${i}`,
      tags: ["veg"],
      costTier: "STANDARD",
      isVegetarian: true,
      nutritionPer100g: { ...n },
      isActive: true,
      kitchenStyle: styles[(i + 3) % styles.length],
    });
  }
  for (let i = 0; i < 12; i += 1) {
    out.push({
      _id: `${prefix}-prem-${i}`,
      title: `Premium ${prefix} ${i}`,
      tags: ["beef"],
      costTier: "PREMIUM",
      nutritionPer100g: { ...n },
      estimatedCostPerPortion: 88,
      isActive: true,
      kitchenStyle: styles[(i + 4) % styles.length],
    });
  }
  return out;
}

function mockSupabaseForTiers(tiers: Array<"BASIS" | "LUXUS" | "ENTERPRISE">): SupabaseClient {
  const admin = {
    from: (table: string) => {
      if (table === "agreements") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: "ag1" }], error: null }),
          }),
        };
      }
      if (table === "agreement_delivery_days") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: tiers.map((tier) => ({ tier })),
                error: null,
              }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return admin as unknown as SupabaseClient;
}

describe("fetchMealIdeaBank GROQ params", () => {
  it("ENTERPRISE sender kun currentSeason til Sanity", async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    await fetchMealIdeaBank({ fetch } as unknown as SanityClient, "ENTERPRISE", false);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('allowedPlanTiers[0] == "ENTERPRISE"'),
      { currentSeason: expect.any(String) },
    );
  });

  it("BASIS sender currentSeason og tier", async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    await fetchMealIdeaBank({ fetch } as unknown as SanityClient, "BASIS", false);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("$tier in allowedPlanTiers"), {
      currentSeason: expect.any(String),
      tier: "BASIS",
    });
  });
});

describe("runMenuWeekRollout", () => {
  const fixedInstant = new Date("2026-05-15T12:00:00.000Z");
  const expectedDates = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"];

  let fetchImpl: (q: string, params?: Record<string, unknown>) => Promise<unknown>;
  let sanityRead: SanityClient;
  let createdDocs: unknown[];

  beforeEach(() => {
    createdDocs = [];
    let bankCall = 0;
    fetchImpl = async (q: string) => {
      if (q.includes('_type == "mealIdea"')) {
        bankCall += 1;
        return diverseMealsFixture(`b${bankCall}`);
      }
      if (q.includes("{ date, mealTitle }")) return [];
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchImpl(q, p)),
    } as unknown as SanityClient;
  });

  function mockWrite() {
    return {
      transaction: () => {
        const chain = {
          createOrReplace: vi.fn((doc: unknown) => {
            createdDocs.push(doc);
            return chain;
          }),
          patch: vi.fn(() => chain),
          commit: vi.fn(async () => {}),
        };
        return chain;
      },
    } as unknown as SanityClient;
  }

  it("ingen menuDays: 3 tiers × 5 dager = 15 opprettet, alle publisert + autoFilled", async () => {
    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.targetWeek).toBe("2026-06-01");
    expect(res.tiersProcessed).toEqual(["BASIS", "LUXUS", "ENTERPRISE"]);
    expect(res.menuDaysSkipped).toBe(0);
    expect(res.errors).toEqual([]);
    expect(res.menuDaysCreated).toBe(15);

    expect(createdDocs).toHaveLength(15);
    for (const doc of createdDocs as Array<Record<string, unknown>>) {
      expect(doc.customerVisible).toBe(true);
      expect(doc.approvedForPublish).toBe(true);
      expect(doc.autoFilled).toBe(true);
      expect(doc.category).toBe("varmrett");
      expect(expectedDates).toContain(doc.date);
    }
  });

  it("alle menuDays finnes allerede: 0 opprettet, 15 hoppet over", async () => {
    fetchImpl = async (q: string) => {
      if (q.includes('_type == "mealIdea"')) return diverseMealsFixture("x");
      if (q.includes("{ date, mealTitle }")) {
        return expectedDates.map((date) => ({ date, mealTitle: "Existing" }));
      }
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchImpl(q, p)),
    } as unknown as SanityClient;

    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.menuDaysCreated).toBe(0);
    expect(res.menuDaysSkipped).toBe(15);
    expect(createdDocs).toHaveLength(0);
  });

  it("delvis BASIS: 2 eksisterende → 3 nye for BASIS, andre tiers fullt", async () => {
    fetchImpl = async (q: string, params?: Record<string, unknown>) => {
      if (q.includes('_type == "mealIdea"')) return diverseMealsFixture("p");
      if (q.includes("{ date, mealTitle }")) {
        if (params?.tier === "BASIS") {
          return [
            { date: "2026-06-01", mealTitle: "A" },
            { date: "2026-06-02", mealTitle: "B" },
          ];
        }
        return [];
      }
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchImpl(q, p)),
    } as unknown as SanityClient;

    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.menuDaysSkipped).toBe(2);
    expect(res.menuDaysCreated).toBe(13);
    expect(createdDocs).toHaveLength(13);
  });
});

describe("validateRolloutWeekMondayIso", () => {
  it("godtar mandag 2026-05-18 (Europe/Oslo)", () => {
    expect(validateRolloutWeekMondayIso("2026-05-18")).toBe("2026-05-18");
  });

  it("kaster når dato ikke er mandag i Oslo", () => {
    expect(() => validateRolloutWeekMondayIso("2026-05-19")).toThrow(/ikke mandag/);
  });

  it("kaster på ugyldig kalenderdato / format", () => {
    expect(() => validateRolloutWeekMondayIso("2026-02-31")).toThrow(/ugyldig dato/);
    expect(() => validateRolloutWeekMondayIso("not-a-date")).toThrow(/ugyldig dato/);
  });
});

describe("runMenuWeekRollout overrideTargetWeekMonday", () => {
  const fixedInstant = new Date("2026-05-15T12:00:00.000Z");
  const n3Monday = "2026-06-01";
  const overrideMonday = "2026-05-18";
  const overrideWeekDates = ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"];

  let fetchImpl: (q: string, params?: Record<string, unknown>) => Promise<unknown>;
  let sanityRead: SanityClient;
  let createdDocs: unknown[];

  type Chain = {
    createOrReplace: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    createdDocs = [];
    let bankCall = 0;
    fetchImpl = async (q: string) => {
      if (q.includes('_type == "mealIdea"')) {
        bankCall += 1;
        return diverseMealsFixture(`b${bankCall}`);
      }
      if (q.includes("{ date, mealTitle }")) return [];
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchImpl(q, p)),
    } as unknown as SanityClient;
  });

  function mockWrite(): SanityClient {
    return {
      transaction: () => {
        const chain = {} as Chain;
        chain.createOrReplace = vi.fn((doc: unknown) => {
          createdDocs.push(doc);
          return chain;
        });
        chain.patch = vi.fn(() => chain);
        chain.commit = vi.fn(async () => {});
        return chain;
      },
    } as unknown as SanityClient;
  }

  it("bruker override og ignorerer N+3-beregning for instant", async () => {
    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      overrideTargetWeekMonday: overrideMonday,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.targetWeek).toBe(overrideMonday);
    expect(res.targetWeek).not.toBe(n3Monday);
    expect(res.menuDaysCreated).toBe(15);
    expect(createdDocs).toHaveLength(15);
    for (const doc of createdDocs as Array<Record<string, unknown>>) {
      expect(overrideWeekDates).toContain(doc.date);
    }
  });

  it("uten gyldig override (kun whitespace): samme N+3 som før", async () => {
    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      overrideTargetWeekMonday: "  \t\n",
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.targetWeek).toBe(n3Monday);
    expect(res.menuDaysCreated).toBe(15);
  });

  it("override som ikke er mandag: kaster", async () => {
    await expect(
      runMenuWeekRollout({
        instant: fixedInstant,
        overrideTargetWeekMonday: "2026-05-20",
        supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
        sanityRead,
        getSanityWrite: mockWrite,
      }),
    ).rejects.toThrow(/ikke mandag/);
  });

  it("override med ugyldig format: kaster", async () => {
    await expect(
      runMenuWeekRollout({
        instant: fixedInstant,
        overrideTargetWeekMonday: "2026-02-31",
        supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
        sanityRead,
        getSanityWrite: mockWrite,
      }),
    ).rejects.toThrow(/ugyldig dato/);
  });

  it("idempotent med override: alle finnes → 0 opprettet", async () => {
    const fetchWithExisting = async (q: string, _p?: Record<string, unknown>) => {
      if (q.includes('_type == "mealIdea"')) return diverseMealsFixture("idem");
      if (q.includes("{ date, mealTitle }")) {
        return overrideWeekDates.map((date) => ({ date, mealTitle: "Existing" }));
      }
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchWithExisting(q, p)),
    } as unknown as SanityClient;

    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      overrideTargetWeekMonday: overrideMonday,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.menuDaysCreated).toBe(0);
    expect(res.menuDaysSkipped).toBe(15);
    expect(createdDocs).toHaveLength(0);
  });
});
