import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SanityClient } from "@sanity/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
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
      title: `Hovedrett ${prefix}-std-${i}`,
      description: `Besk ${i}`,
      tags: [tagsRot[i % tagsRot.length]!],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      nutritionScore: 7,
      estimatedCostPerPortion: 70,
      allergens: [],
      isActive: true,
      kitchenStyle: styles[i % styles.length],
      method: `method-${i % 11}`,
    });
  }
  for (let i = 0; i < 20; i += 1) {
    out.push({
      _id: `${prefix}-suppe-${i}`,
      title: `Suppe ${prefix}-${i}`,
      tags: ["suppe", "chicken"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      isSoup: true,
      isActive: true,
      kitchenStyle: styles[(i + 1) % styles.length],
      method: `suppe-${i % 7}`,
    });
  }
  for (let i = 0; i < 20; i += 1) {
    out.push({
      _id: `${prefix}-fisk-${i}`,
      title: `Fisk ${prefix}-${i}`,
      tags: ["fisk"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      estimatedCostPerPortion: 72,
      isFishDish: true,
      isActive: true,
      kitchenStyle: styles[(i + 2) % styles.length],
      method: `fisk-${i % 7}`,
    });
  }
  for (let i = 0; i < 20; i += 1) {
    out.push({
      _id: `${prefix}-fre-${i}`,
      title: `Fredagskos ${prefix} pizza-${i}`,
      tags: ["fredagskos", "pork"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      estimatedCostPerPortion: 55,
      isActive: true,
      kitchenStyle: styles[(i + 3) % styles.length],
      method: `fre-${i % 9}`,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    out.push({
      _id: `${prefix}-veg-${i}`,
      title: `Veg ${prefix}-${i}`,
      tags: ["veg"],
      costTier: "STANDARD",
      isVegetarian: true,
      nutritionPer100g: { ...n },
      isActive: true,
      kitchenStyle: styles[(i + 4) % styles.length],
    });
  }
  for (let i = 0; i < 12; i += 1) {
    out.push({
      _id: `${prefix}-prem-${i}`,
      title: `Premium ${prefix}-${i}`,
      tags: ["beef"],
      costTier: "PREMIUM",
      nutritionPer100g: { ...n },
      estimatedCostPerPortion: 88,
      isActive: true,
      kitchenStyle: styles[(i + 5) % styles.length],
    });
  }
  return out;
}

/** Legg på prod-lignende «støy»-tags som ikke skal knekke generatoren etter tagTaxonomy. */
function diverseMealsWithNoise(prefix: string): Meal[] {
  return diverseMealsFixture(prefix).map((m) => ({
    ...m,
    tags: [...(m.tags ?? []), "lunsj", "varmmat"],
  }));
}

function mockSupabaseForTiers(
  tiers: Array<"BASIS" | "LUXUS" | "ENTERPRISE">,
  probe?: { providerIdFilter?: string },
): SupabaseClient {
  const admin = {
    from: (table: string) => {
      if (table === "agreements") {
        return {
          select: () => ({
            // .eq("status","ACTIVE").eq("provider_id", pid) — provider-scoped tier-utledning
            eq: () => ({
              eq: (_col: string, providerId: string) => {
                if (probe) probe.providerIdFilter = providerId;
                return Promise.resolve({ data: [{ id: "ag1" }], error: null });
              },
            }),
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

  function sharedBankFixture() {
    return diverseMealsFixture("shared-bank");
  }

  beforeEach(() => {
    createdDocs = [];
    fetchImpl = async (q: string, params?: Record<string, unknown>) => {
      if (q.includes('_type == "mealIdea"')) {
        return sharedBankFixture();
      }
      if (q.includes("mealRefId")) {
        return [];
      }
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
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.targetWeek).toBe("2026-06-01");
    expect(res.providerRef).toBe(MELHUS_PROVIDER_SANITY_ID);
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
      expect((doc.provider as { _ref?: string })?._ref).toBe("11111111-1111-1111-1111-111111111111");
      expect(expectedDates).toContain(doc.date);
    }

    const basisDocs = (createdDocs as Array<Record<string, unknown>>).filter((d) => d.planTier === "BASIS");
    const luxusDocs = (createdDocs as Array<Record<string, unknown>>).filter((d) => d.planTier === "LUXUS");
    const enterpriseDocs = (createdDocs as Array<Record<string, unknown>>).filter(
      (d) => d.planTier === "ENTERPRISE",
    );
    expect(basisDocs).toHaveLength(5);
    expect(luxusDocs).toHaveLength(5);
    expect(enterpriseDocs).toHaveLength(5);
    for (const date of expectedDates) {
      const b = basisDocs.find((d) => d.date === date);
      const l = luxusDocs.find((d) => d.date === date);
      const e = enterpriseDocs.find((d) => d.date === date);
      expect(b?.mealTitle).toBe(l?.mealTitle);
      expect(b?.mealTitle).toBe(e?.mealTitle);
      expect((b?.mealRef as { _ref?: string })?._ref).toBe((l?.mealRef as { _ref?: string })?._ref);
      expect((b?.mealRef as { _ref?: string })?._ref).toBe((e?.mealRef as { _ref?: string })?._ref);
    }
  });

  it("ENTERPRISE i avtaler gir identisk delt ukeplan som kun BASIS+LUXUS (regresjon)", async () => {
    const runForTiers = async (tiers: Array<"BASIS" | "LUXUS" | "ENTERPRISE">) => {
      const res = await runMenuWeekRollout({
        instant: fixedInstant,
        sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
        supabaseAdmin: () => mockSupabaseForTiers(tiers),
        sanityRead,
        getSanityWrite: mockWrite,
        dryRun: true,
      });
      return (res.sharedWeekPlan ?? []).map((d) => d.mealTitle);
    };

    const basisLuxusOnly = await runForTiers(["BASIS", "LUXUS"]);
    const allThree = await runForTiers(["BASIS", "LUXUS", "ENTERPRISE"]);
    expect(basisLuxusOnly).toEqual(allThree);
    expect(basisLuxusOnly).toHaveLength(5);
  });

  it("2× rollout med samme fixtures gir identisk delt ukeplan", async () => {
    const run = async () => {
      const docs: unknown[] = [];
      const res = await runMenuWeekRollout({
        instant: fixedInstant,
        sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
        supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS"]),
        sanityRead,
        getSanityWrite: () => ({
          transaction: () => {
            const chain = {
              createOrReplace: vi.fn((doc: unknown) => {
                docs.push(doc);
                return chain;
              }),
              patch: vi.fn(() => chain),
              commit: vi.fn(async () => {}),
            };
            return chain;
          },
        }) as unknown as SanityClient,
      });
      return { res, titles: (res.sharedWeekPlan ?? []).map((d) => d.mealTitle) };
    };

    const first = await run();
    createdDocs = [];
    const second = await run();
    expect(first.titles).toEqual(second.titles);
    expect(first.titles).toHaveLength(5);
  });

  it("generert uke følger ukedag-pins (suppe/fisk/fredagskos)", async () => {
    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    const plan = res.sharedWeekPlan ?? [];
    expect(plan[1]?.mealTitle).toMatch(/Suppe/i);
    expect(plan[3]?.mealTitle).toMatch(/Fisk/i);
    expect(plan[4]?.mealTitle).toMatch(/Fredagskos/i);
  });

  it("alle menuDays finnes allerede: 0 opprettet, 15 hoppet over", async () => {
    fetchImpl = async (q: string) => {
      if (q.includes('_type == "mealIdea"')) return sharedBankFixture();
      if (q.includes("mealRefId")) {
        return expectedDates.map((date) => ({
          date,
          mealTitle: "Existing",
          description: "Existing desc",
          nutritionPer100g: { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 },
          mealRefId: "meal-existing",
        }));
      }
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchImpl(q, p)),
    } as unknown as SanityClient;

    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.menuDaysCreated).toBe(0);
    expect(res.menuDaysSkipped).toBe(15);
    expect(createdDocs).toHaveLength(0);
  });

  it("delvis BASIS: eksisterende mandag gjenbrukes for Luxus (felles varmrett)", async () => {
    const canonicalTitle = "Kanonisk mandag fra Basis";
    fetchImpl = async (q: string, params?: Record<string, unknown>) => {
      if (q.includes('_type == "mealIdea"')) return sharedBankFixture();
      if (q.includes("mealRefId")) {
        if (params?.tier === "BASIS") {
          return [
            {
              date: "2026-06-01",
              mealTitle: canonicalTitle,
              description: canonicalTitle,
              nutritionPer100g: { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 },
              mealRefId: "meal-canonical-mon",
            },
            {
              date: "2026-06-02",
              mealTitle: "Basis tirsdag",
              description: "Basis tirsdag",
              nutritionPer100g: { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 },
              mealRefId: "meal-canonical-tue",
            },
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
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.menuDaysSkipped).toBe(2);
    expect(res.menuDaysCreated).toBe(13);
    expect(res.errors).toEqual([]);

    const luxusMonday = (createdDocs as Array<Record<string, unknown>>).find(
      (d) => d.planTier === "LUXUS" && d.date === "2026-06-01",
    );
    const enterpriseMonday = (createdDocs as Array<Record<string, unknown>>).find(
      (d) => d.planTier === "ENTERPRISE" && d.date === "2026-06-01",
    );
    expect(luxusMonday?.mealTitle).toBe(canonicalTitle);
    expect(enterpriseMonday?.mealTitle).toBe(canonicalTitle);
    expect((luxusMonday?.mealRef as { _ref?: string })?._ref).toBe("meal-canonical-mon");
  });

  it("usageCount dedup: én patch per mealId selv om retten skrives til BASIS og LUXUS", async () => {
    const patches: Array<{ id: string; ops: unknown }> = [];
    const writeWithPatchSpy = {
      transaction: () => {
        const chain = {
          createOrReplace: vi.fn((doc: unknown) => {
            createdDocs.push(doc);
            return chain;
          }),
          patch: vi.fn((id: string, ops: unknown) => {
            patches.push({ id, ops });
            return chain;
          }),
          commit: vi.fn(async () => {}),
        };
        return chain;
      },
    } as unknown as SanityClient;

    createdDocs = [];
    await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS"]),
      sanityRead,
      getSanityWrite: () => writeWithPatchSpy,
    });

    const usagePatches = patches.filter(
      (p) => (p.ops as { inc?: { usageCount?: number } })?.inc?.usageCount === 1,
    );
    expect(usagePatches.length).toBe(5);
    const ids = usagePatches.map((p) => p.id);
    expect(new Set(ids).size).toBe(5);
  });

  it("legacy tier-divergens blokkerer rollout (fail-closed)", async () => {
    fetchImpl = async (q: string, params?: Record<string, unknown>) => {
      if (q.includes('_type == "mealIdea"')) return sharedBankFixture();
      if (q.includes("mealRefId")) {
        if (params?.tier === "BASIS") {
          return [
            {
              date: "2026-06-01",
              mealTitle: "Basis rett A",
              description: "Basis rett A",
              nutritionPer100g: { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 },
              mealRefId: "meal-a",
            },
          ];
        }
        if (params?.tier === "LUXUS") {
          return [
            {
              date: "2026-06-01",
              mealTitle: "Luxus rett B",
              description: "Luxus rett B",
              nutritionPer100g: { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 },
              mealRefId: "meal-b",
            },
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
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.menuDaysCreated).toBe(0);
    expect(res.errors.some((e) => e.includes("Legacy tier-divergens"))).toBe(true);
    expect(createdDocs).toHaveLength(0);
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
    fetchImpl = async (q: string) => {
      if (q.includes('_type == "mealIdea"')) {
        return diverseMealsFixture("shared-bank");
      }
      if (q.includes("mealRefId")) return [];
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
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
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
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
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
        sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
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
        sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
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
      if (q.includes("mealRefId")) {
        return overrideWeekDates.map((date) => ({
          date,
          mealTitle: "Existing",
          description: "Existing",
          nutritionPer100g: { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 },
          mealRefId: "meal-existing",
        }));
      }
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchWithExisting(q, p)),
    } as unknown as SanityClient;

    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      overrideTargetWeekMonday: overrideMonday,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    expect(res.menuDaysCreated).toBe(0);
    expect(res.menuDaysSkipped).toBe(15);
    expect(createdDocs).toHaveLength(0);
  });

  it.each([
    ["2026-06-08"],
    ["2026-06-15"],
    ["2026-07-06"],
  ])("sommeruke %s: BASIS+LUXUS med lunsj/varmmat-støy — 5 dager uten feil", async (monday) => {
    const reproClock = new Date("2026-05-15T12:00:00.000Z");
    fetchImpl = async (q: string) => {
      if (q.includes('_type == "mealIdea"')) return diverseMealsWithNoise(`week-${monday}`);
      if (q.includes("mealRefId")) return [];
      if (q.includes("{ mealTitle, description }")) return [];
      return [];
    };
    sanityRead = {
      fetch: vi.fn((q: string, p?: Record<string, unknown>) => fetchImpl(q, p)),
    } as unknown as SanityClient;
    createdDocs = [];

    const relaxCalls: string[] = [];
    const errSpy = vi.spyOn(console, "error").mockImplementation((msg?: unknown) => {
      if (typeof msg === "string" && msg.includes("LP_MENU_GENERATOR_RELAX")) {
        relaxCalls.push(msg);
      }
    });

    const res = await runMenuWeekRollout({
      instant: reproClock,
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      overrideTargetWeekMonday: monday,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS"]),
      sanityRead,
      getSanityWrite: mockWrite,
    });

    errSpy.mockRestore();

    expect(res.targetWeek).toBe(monday);
    expect(res.errors).toEqual([]);
    expect(res.menuDaysCreated).toBe(10);
    expect(res.menuDaysSkipped).toBe(0);
    expect(createdDocs).toHaveLength(10);

    const byTier = new Map<string, Array<{ date: string; kitchenStyle?: unknown }>>();
    for (const doc of createdDocs as Array<Record<string, unknown>>) {
      const t = String(doc.planTier ?? "");
      if (!byTier.has(t)) byTier.set(t, []);
      byTier.get(t)!.push({ date: String(doc.date), kitchenStyle: doc.kitchenStyle });
    }
    for (const rows of byTier.values()) {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].kitchenStyle === rows[i - 1].kitchenStyle) {
          expect(relaxCalls.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("runMenuWeekRollout provider-scope (P0 multi-provider data-correctness)", () => {
  const fixedInstant = new Date("2026-05-15T12:00:00.000Z");
  const expectedDates = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"];
  const PROVIDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const PROVIDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  /** Sanity-read der eksisterende menuDays KUN returneres for matching providerRef (provider-scoped GROQ). */
  function mkSanityRead(existingByProvider: Record<string, Array<{ date: string; mealTitle: string }>>) {
    const fetch = vi.fn(async (q: string, p?: Record<string, unknown>) => {
      if (q.includes('_type == "mealIdea"')) {
        return diverseMealsFixture("shared-bank");
      }
      if (q.includes("mealRefId")) {
        expect(q).toContain("provider._ref == $providerRef");
        const rows = existingByProvider[String(p?.providerRef ?? "")] ?? [];
        return rows.map((r) => ({
          ...r,
          description: r.mealTitle,
          nutritionPer100g: { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 },
          mealRefId: `meal-${r.date}`,
        }));
      }
      if (q.includes("{ mealTitle, description }")) {
        expect(q).toContain("provider._ref == $providerRef");
        return [];
      }
      return [];
    });
    return { fetch } as unknown as SanityClient;
  }

  function mkWrite(createdDocs: unknown[]): () => SanityClient {
    return () =>
      ({
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
      }) as unknown as SanityClient;
  }

  it("provider A og B oppretter hver sine menuDays: egne provider._ref og egne doc-ids for samme dato/tier/kategori", async () => {
    const docsA: unknown[] = [];
    const docsB: unknown[] = [];

    const resA = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: PROVIDER_A,
      providerSlug: "provider-a",
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
      sanityRead: mkSanityRead({}),
      getSanityWrite: mkWrite(docsA),
    });
    const resB = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: PROVIDER_B,
      providerSlug: "provider-b",
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
      sanityRead: mkSanityRead({}),
      getSanityWrite: mkWrite(docsB),
    });

    expect(resA.providerRef).toBe(PROVIDER_A);
    expect(resA.providerSlug).toBe("provider-a");
    expect(resB.providerRef).toBe(PROVIDER_B);
    expect(resA.menuDaysCreated).toBe(5);
    expect(resB.menuDaysCreated).toBe(5);

    for (const doc of docsA as Array<Record<string, unknown>>) {
      expect((doc.provider as { _ref?: string })?._ref).toBe(PROVIDER_A);
      expect(String(doc._id)).toBe(`menuDay-${PROVIDER_A}-${doc.date}-BASIS-varmrett`);
    }
    for (const doc of docsB as Array<Record<string, unknown>>) {
      expect((doc.provider as { _ref?: string })?._ref).toBe(PROVIDER_B);
      expect(String(doc._id)).toBe(`menuDay-${PROVIDER_B}-${doc.date}-BASIS-varmrett`);
    }

    // Samme dato/tier/kategori kan eksistere for A og B separat — ingen id-kollisjon.
    const idsA = new Set((docsA as Array<{ _id: string }>).map((d) => d._id));
    for (const doc of docsB as Array<{ _id: string }>) {
      expect(idsA.has(doc._id)).toBe(false);
    }
  });

  it("provider A sine eksisterende docs blokkerer ikke provider B (existence er provider-scoped)", async () => {
    const existingForA = expectedDates.map((date) => ({ date, mealTitle: "Existing A" }));

    const docsB: unknown[] = [];
    const resB = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: PROVIDER_B,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
      sanityRead: mkSanityRead({ [PROVIDER_A]: existingForA }),
      getSanityWrite: mkWrite(docsB),
    });

    expect(resB.menuDaysCreated).toBe(5);
    expect(resB.menuDaysSkipped).toBe(0);

    // …og A ser sine egne (idempotent for A): 0 opprettet, 5 hoppet over.
    const docsA: unknown[] = [];
    const resA = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: PROVIDER_A,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
      sanityRead: mkSanityRead({ [PROVIDER_A]: existingForA }),
      getSanityWrite: mkWrite(docsA),
    });
    expect(resA.menuDaysCreated).toBe(0);
    expect(resA.menuDaysSkipped).toBe(5);
    expect(docsA).toHaveLength(0);
  });

  it("tier-utledning er provider-scoped: agreements filtreres på provider_id", async () => {
    const probe: { providerIdFilter?: string } = {};
    const docs: unknown[] = [];

    await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: PROVIDER_A,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS"], probe),
      sanityRead: mkSanityRead({}),
      getSanityWrite: mkWrite(docs),
    });

    expect(probe.providerIdFilter).toBe(PROVIDER_A);
  });

  it("manglende provider-scope → fail-closed (kaster), aldri Melhus-fallback", async () => {
    const docs: unknown[] = [];

    await expect(
      runMenuWeekRollout({
        instant: fixedInstant,
        sanityProviderRef: "   ",
        supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
        sanityRead: mkSanityRead({}),
        getSanityWrite: mkWrite(docs),
      }),
    ).rejects.toThrow(/sanityProviderRef er påkrevd/);

    expect(docs).toHaveLength(0);
  });

  it("ingen skjult Melhus-fallback i core: provider B-docs har aldri Melhus-ref", async () => {
    const docsB: unknown[] = [];

    await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: PROVIDER_B,
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
      sanityRead: mkSanityRead({}),
      getSanityWrite: mkWrite(docsB),
    });

    expect(docsB.length).toBeGreaterThan(0);
    for (const doc of docsB as Array<Record<string, unknown>>) {
      expect((doc.provider as { _ref?: string })?._ref).not.toBe(MELHUS_PROVIDER_SANITY_ID);
      expect(String(doc._id)).not.toBe(`menuDay-${doc.date}-${doc.planTier}-varmrett`);
    }
  });

  it("eksplisitt Melhus-flow fungerer fortsatt: Melhus-ref + legacy doc-id uten provider-segment", async () => {
    const docs: unknown[] = [];

    const res = await runMenuWeekRollout({
      instant: fixedInstant,
      sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
      providerSlug: "melhus-catering",
      supabaseAdmin: () => mockSupabaseForTiers(["BASIS"]),
      sanityRead: mkSanityRead({}),
      getSanityWrite: mkWrite(docs),
    });

    expect(res.providerRef).toBe(MELHUS_PROVIDER_SANITY_ID);
    expect(res.menuDaysCreated).toBe(5);
    for (const doc of docs as Array<Record<string, unknown>>) {
      expect((doc.provider as { _ref?: string })?._ref).toBe(MELHUS_PROVIDER_SANITY_ID);
      // Kontinuitet: Melhus beholder historisk id-skjema (idempotent mot eksisterende docs).
      expect(String(doc._id)).toBe(`menuDay-${doc.date}-BASIS-varmrett`);
    }
  });
});
