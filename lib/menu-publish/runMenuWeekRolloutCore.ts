import type { SanityClient } from "@sanity/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
import { addDaysISO, isIsoDate, nowISO } from "@/lib/date/oslo";

import {
  mondayToFridayIso,
  startOfWeekMondayNPlus3,
  utcInstantToOsloDateISO,
} from "./calendar";
import {
  buildRolloutSelectionSeed,
  generateWeekMenu,
  mergeMealPoolsById,
  getWeekdayCategoryPin,
  type Meal,
  type PlanTier,
} from "./generateWeekMenu";
import {
  fetchMealIdeaBank,
  hasCompleteNutrition,
  normalizeMenuTitleKey,
} from "./mealIdeaBankQuery";

const MENU_DAY_CATEGORY = "varmrett" as const;

/** Tiers som får auto-filled menuDay ved rollout (inkl. ENTERPRISE fra Fase 3a). */
const ROLLOUT_WRITE_TIERS: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

/**
 * Tiers brukt til mealIdea-pool-intersection for ukegenerering.
 * ENTERPRISE utelates her slik at BASIS/LUXUS-output forblir identisk når begge er aktive.
 */
const ROLLOUT_GENERATION_TIERS: PlanTier[] = ["BASIS", "LUXUS"];

export type SharedWeekDayPlan = {
  date: string;
  mealTitle: string;
  mealId: string;
  /** Legacy flag — generator fyller alle dager deterministisk (Fase 3a). */
  unfilled?: boolean;
};

export type MenuWeekRolloutResult = {
  targetWeek: string;
  /** Eksplisitt provider-scope brukt for hele rollouten (Sanity provider._ref == Supabase providers.id). */
  providerRef: string;
  providerSlug: string | null;
  tiersProcessed: PlanTier[];
  menuDaysCreated: number;
  menuDaysSkipped: number;
  errors: string[];
  /** Kanonisk delt ukeplan (mandag–fredag) — for dry-run/preview. */
  sharedWeekPlan?: SharedWeekDayPlan[];
};

type ExistingMenuDayRow = {
  date?: string | null;
  planTier?: string | null;
  mealTitle?: string | null;
  description?: string | null;
  allergens?: string[] | null;
  mayContain?: string[] | null;
  nutritionPer100g?: Meal["nutritionPer100g"];
  kitchenStyle?: string | null;
  costTier?: Meal["costTier"];
  estimatedCostPerPortion?: number | null;
  isFishDish?: boolean | null;
  isSoup?: boolean | null;
  isVegetarian?: boolean | null;
  mealRefId?: string | null;
};

/**
 * Deterministisk menuDay-id per provider.
 * Kontinuitetsregel (ikke fallback): Melhus beholder historisk id-skjema uten provider-segment,
 * slik at eksisterende docs og Studio-tooling forblir idempotente. Alle andre providere får
 * provider-ref i id-en — to providere kan dermed aldri overskrive hverandres dokumenter.
 */
function docIdMenuDay(providerRef: string, date: string, tier: PlanTier): string {
  if (providerRef === MELHUS_PROVIDER_SANITY_ID) {
    return `menuDay-${date}-${tier}-${MENU_DAY_CATEGORY}`;
  }
  return `menuDay-${providerRef}-${date}-${tier}-${MENU_DAY_CATEGORY}`;
}

/** Aktive tiers for ÉN provider — aldri global tier-utledning på tvers av providere. */
export async function loadActivePlanTiers(admin: SupabaseClient, providerId: string): Promise<PlanTier[]> {
  const pid = String(providerId ?? "").trim();
  if (!pid) {
    throw new Error("loadActivePlanTiers: providerId er påkrevd (fail-closed, ingen global tier-utledning).");
  }

  const { data: activeAgreements, error: aErr } = await admin
    .from("agreements")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("provider_id", pid);

  if (aErr) {
    throw new Error(`agreements ACTIVE lookup failed: ${aErr.message}`);
  }

  const ids = (Array.isArray(activeAgreements) ? activeAgreements : [])
    .map((r: { id?: string }) => String(r?.id ?? "").trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return [];
  }

  const { data: dayRows, error: dErr } = await admin
    .from("agreement_delivery_days")
    .select("tier")
    .in("agreement_id", ids);

  if (dErr) {
    throw new Error(`agreement_delivery_days tier lookup failed: ${dErr.message}`);
  }

  const seen = new Set<string>();
  for (const row of Array.isArray(dayRows) ? dayRows : []) {
    const t = String((row as { tier?: string })?.tier ?? "").trim();
    if (t) seen.add(t);
  }

  return ROLLOUT_WRITE_TIERS.filter((t) => seen.has(t));
}

/** Pool-intersection for ukegenerering — BASIS/LUXUS når begge finnes; ellers aktiv tier. */
function rolloutGenerationTiers(activeTiers: PlanTier[]): PlanTier[] {
  const fromBasisLuxus = ROLLOUT_GENERATION_TIERS.filter((t) => activeTiers.includes(t));
  if (fromBasisLuxus.length > 0) return fromBasisLuxus;
  return activeTiers.filter((t) => t === "ENTERPRISE");
}

async function fetchExistingMenuDaysForWeek(
  sanity: SanityClient,
  providerRef: string,
  dates: string[],
  tier: PlanTier,
): Promise<ExistingMenuDayRow[]> {
  const rows = await sanity.fetch<ExistingMenuDayRow[]>(
    `*[
      _type == "menuDay" &&
      provider._ref == $providerRef &&
      date in $dates &&
      planTier == $tier &&
      category == $category &&
      !(_id in path("drafts.**"))
    ]{
      date,
      planTier,
      mealTitle,
      description,
      allergens,
      mayContain,
      nutritionPer100g,
      kitchenStyle,
      costTier,
      estimatedCostPerPortion,
      isFishDish,
      isSoup,
      isVegetarian,
      "mealRefId": mealRef._ref
    }`,
    { providerRef, dates, tier, category: MENU_DAY_CATEGORY },
  );

  return Array.isArray(rows) ? rows : [];
}

async function fetchCooldownTitleKeys(
  sanity: SanityClient,
  providerRef: string,
  weekMondayISO: string,
): Promise<Set<string>> {
  const from = addDaysISO(weekMondayISO, -28);
  const to = addDaysISO(weekMondayISO, -1);

  const rows = await sanity.fetch<Array<{ mealTitle?: string | null; description?: string | null }>>(
    `*[
      _type == "menuDay" &&
      provider._ref == $providerRef &&
      date >= $from &&
      date <= $to &&
      !(_id in path("drafts.**"))
    ] { mealTitle, description }`,
    { providerRef, from, to },
  );

  const keys = new Set<string>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const k = normalizeMenuTitleKey(r.mealTitle || r.description || "");
    if (k) keys.add(k);
  }
  return keys;
}

/** Snitt av mealIdea-pooler — rett må finnes i ALLE pools (intersection på _id). */
export function intersectMealPools(...pools: Meal[][]): Meal[] {
  if (pools.length === 0) return [];
  const idSets = pools.map((pool) => new Set(pool.map((m) => m._id)));
  const firstById = new Map(pools[0]!.map((m) => [m._id, m]));
  const ids = [...firstById.keys()].filter((id) => idSets.every((set) => set.has(id)));
  return ids.map((id) => firstById.get(id)!);
}

function mealFromExistingRow(row: ExistingMenuDayRow, date: string): Meal {
  const title = String(row.mealTitle ?? "").trim() || String(row.description ?? "").trim();
  const mealRefId = String(row.mealRefId ?? "").trim();
  return {
    _id: mealRefId || `existing-${date}-${normalizeMenuTitleKey(title)}`,
    title,
    description: String(row.description ?? "").trim() || title,
    tags: [],
    costTier: row.costTier ?? "STANDARD",
    allergens: Array.isArray(row.allergens) ? [...row.allergens] : [],
    mayContain: Array.isArray(row.mayContain) ? [...row.mayContain] : [],
    nutritionPer100g: row.nutritionPer100g ?? null,
    kitchenStyle: row.kitchenStyle ?? "international",
    estimatedCostPerPortion:
      typeof row.estimatedCostPerPortion === "number" ? row.estimatedCostPerPortion : undefined,
    isFishDish: row.isFishDish === true,
    isSoup: row.isSoup === true,
    isVegetarian: row.isVegetarian === true,
    isActive: true,
  };
}

function buildMenuDayCreatePayload(
  providerRef: string,
  date: string,
  tier: PlanTier,
  meal: Meal,
  stamp: string,
) {
  return {
    _id: docIdMenuDay(providerRef, date, tier),
    _type: "menuDay" as const,
    provider: { _type: "reference" as const, _ref: providerRef },
    date,
    planTier: tier,
    category: MENU_DAY_CATEGORY,
    mealRef: { _type: "reference" as const, _ref: meal._id },
    mealTitle: meal.title,
    description: (meal.description ?? "").trim() || meal.title,
    allergens: meal.allergens ?? [],
    mayContain: meal.mayContain ?? [],
    nutritionPer100g: meal.nutritionPer100g ?? undefined,
    kitchenStyle: meal.kitchenStyle,
    costTier: meal.costTier,
    estimatedCostPerPortion: meal.estimatedCostPerPortion,
    isFishDish: meal.isFishDish === true,
    isSoup: meal.isSoup === true,
    isVegetarian: meal.isVegetarian === true,
    customerVisible: true,
    approvedForPublish: true,
    customerVisibleSetAt: stamp,
    approvedAt: stamp,
    autoFilled: true,
    providerOverride: false,
    generatedBaseline: {
      mealTitle: meal.title,
      description: (meal.description ?? "").trim() || meal.title,
      allergens: meal.allergens ?? [],
      estimatedCostPerPortion: meal.estimatedCostPerPortion,
    },
  };
}

const OSLO_TZ = "Europe/Oslo";

/** Validates YYYY-MM-DD and at mandag i Europe/Oslo. Retur: trimmet ISO. */
export function validateRolloutWeekMondayIso(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!isIsoDate(s)) {
    throw new Error(`overrideTargetWeekMonday: ugyldig dato (forventet YYYY-MM-DD): ${raw}`);
  }
  const d = new Date(`${s}T12:00:00`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: OSLO_TZ, weekday: "short" }).format(d);
  if (wd !== "Mon") {
    throw new Error(
      `overrideTargetWeekMonday: ${s} er ikke mandag i ${OSLO_TZ} — oppgi ukestart (mandag).`,
    );
  }
  return s;
}

export type RunMenuWeekRolloutOptions = {
  /** Wall-clock instant brukt til N+3 når override ikke er satt, og til Sanity-tidsstempler. */
  instant?: Date;
  /**
   * Eksplisitt provider-scope (Sanity provider._ref == Supabase providers.id).
   * PÅKREVD — fail-closed uten. Ingen Melhus-fallback, ingen «første provider».
   */
  sanityProviderRef: string;
  /** Valgfri slug — kun til logger/respons. */
  providerSlug?: string | null;
  supabaseAdmin: () => SupabaseClient;
  sanityRead: SanityClient;
  getSanityWrite: () => SanityClient;
  /** Overstyr målukes mandag. Standard: rullerende N+3 fra gjeldende Oslo-dato. */
  overrideTargetWeekMonday?: string;
  /** Ingen Sanity commits/patches — teller forslag som om de ble skrevet (krever ikke write-token). */
  dryRun?: boolean;
};

export async function runMenuWeekRollout(opts: RunMenuWeekRolloutOptions): Promise<MenuWeekRolloutResult> {
  const providerRef = String(opts.sanityProviderRef ?? "").trim();
  if (!providerRef) {
    throw new Error(
      "runMenuWeekRollout: sanityProviderRef er påkrevd — fail-closed, ingen Melhus/first-provider-fallback.",
    );
  }
  const providerSlug = String(opts.providerSlug ?? "").trim() || null;

  const instant = opts.instant ?? new Date();
  const targetWeekMonday =
    opts.overrideTargetWeekMonday != null && String(opts.overrideTargetWeekMonday).trim() !== ""
      ? validateRolloutWeekMondayIso(opts.overrideTargetWeekMonday)
      : startOfWeekMondayNPlus3(utcInstantToOsloDateISO(instant));
  const targetDates = mondayToFridayIso(targetWeekMonday);
  const selectionSeed = buildRolloutSelectionSeed(providerRef, targetWeekMonday);

  const errors: string[] = [];
  let menuDaysCreated = 0;
  let menuDaysSkipped = 0;

  let tiersProcessed: PlanTier[] = [];

  try {
    const admin = opts.supabaseAdmin();
    tiersProcessed = await loadActivePlanTiers(admin, providerRef);
  } catch (e: unknown) {
    errors.push(String((e as Error)?.message ?? e));
    return {
      targetWeek: targetWeekMonday,
      providerRef,
      providerSlug,
      tiersProcessed: [],
      menuDaysCreated: 0,
      menuDaysSkipped: 0,
      errors,
    };
  }

  if (tiersProcessed.length === 0) {
    return {
      targetWeek: targetWeekMonday,
      providerRef,
      providerSlug,
      tiersProcessed: [],
      menuDaysCreated: 0,
      menuDaysSkipped: 0,
      errors,
    };
  }

  const write = !opts.dryRun ? opts.getSanityWrite() : null;
  const stamp = nowISO();

  try {
    const existingByTier = new Map<PlanTier, ExistingMenuDayRow[]>();
    const existingDatesByTier = new Map<PlanTier, Set<string>>();

    for (const tier of tiersProcessed) {
      const existing = await fetchExistingMenuDaysForWeek(opts.sanityRead, providerRef, targetDates, tier);
      existingByTier.set(tier, existing);
      const dates = new Set(
        existing.map((r) => String(r.date ?? "").trim()).filter((d) => targetDates.includes(d)),
      );
      existingDatesByTier.set(tier, dates);
      menuDaysSkipped += dates.size;
    }

    const prefilledDays = new Map<number, Meal>();
    for (let i = 0; i < targetDates.length; i += 1) {
      const date = targetDates[i]!;
      const rowsForDate: Array<{ tier: PlanTier; row: ExistingMenuDayRow }> = [];

      for (const tier of tiersProcessed) {
        const row = (existingByTier.get(tier) ?? []).find((r) => String(r.date ?? "").trim() === date);
        if (row) rowsForDate.push({ tier, row });
      }

      if (rowsForDate.length === 0) continue;

      const titleKeys = rowsForDate.map(({ row }) =>
        normalizeMenuTitleKey(row.mealTitle || row.description || ""),
      );
      const uniqueKeys = new Set(titleKeys.filter(Boolean));
      if (uniqueKeys.size > 1) {
        const detail = rowsForDate
          .map(({ tier, row }) => `${tier}="${String(row.mealTitle ?? "").trim()}"`)
          .join(", ");
        errors.push(
          `Legacy tier-divergens på ${date}: ${detail}. Auto-overskriv er blokkert — manuell avstemming kreves.`,
        );
        continue;
      }

      prefilledDays.set(i, mealFromExistingRow(rowsForDate[0]!.row, date));
    }

    if (errors.length > 0) {
      return {
        targetWeek: targetWeekMonday,
        providerRef,
        providerSlug,
        tiersProcessed,
        menuDaysCreated: 0,
        menuDaysSkipped,
        errors,
      };
    }

    const needsGeneration = targetDates.some((_, i) => !prefilledDays.has(i));

    let sharedWeek: (Meal | null)[];

    if (needsGeneration) {
      const avoidTitles = await fetchCooldownTitleKeys(opts.sanityRead, providerRef, targetWeekMonday);
      for (const meal of prefilledDays.values()) {
        const k = normalizeMenuTitleKey(meal.title);
        if (k) avoidTitles.add(k);
      }

      const generationTiers = rolloutGenerationTiers(tiersProcessed);
      const basePools: Meal[][] = [];
      const fridayPools: Meal[][] = [];
      for (const tier of generationTiers) {
        const [baseRaw, fridayRaw] = await Promise.all([
          fetchMealIdeaBank(opts.sanityRead, tier, false, instant),
          fetchMealIdeaBank(opts.sanityRead, tier, true, instant),
        ]);
        basePools.push(baseRaw.filter(hasCompleteNutrition));
        fridayPools.push(fridayRaw.filter(hasCompleteNutrition));
      }

      const baseMeals = intersectMealPools(...basePools);
      const fridayMealsIntersect = intersectMealPools(...fridayPools);
      const bankMeals = mergeMealPoolsById(baseMeals, fridayMealsIntersect);

      if (baseMeals.length < 50) {
        throw new Error(
          `For få retter i snitt-pool (intersection) for ${generationTiers.join("+")}: ${baseMeals.length} (minimum 50).`,
        );
      }

      const generated = generateWeekMenu({
        baseMeals: bankMeals,
        fridayMeals: bankMeals,
        avoidTitles,
        selectionSeed,
        prefilledDays,
      });
      sharedWeek = generated.days;

      if (generated.unfilledDayIndices.length > 0) {
        const detail = generated.unfilledDayIndices
          .map((dayIndex) => {
            const date = targetDates[dayIndex]!;
            const pin = getWeekdayCategoryPin(dayIndex) ?? "ukjent";
            return `${date} (pin «${pin}»)`;
          })
          .join(", ");
        throw new Error(
          `Rollout-generator etterlot tomme dager etter bank-fallback (fail-closed): ${detail}.`,
        );
      }
    } else {
      sharedWeek = targetDates.map((date, i) => prefilledDays.get(i) ?? null);
    }

    for (let i = 0; i < sharedWeek.length; i += 1) {
      if (prefilledDays.has(i)) continue;
      const meal = sharedWeek[i];
      if (meal && !hasCompleteNutrition(meal)) {
        throw new Error(`Retten «${meal.title}» mangler komplett næring i delt ukeplan (dag ${i + 1}).`);
      }
    }

    const sharedWeekPlan: SharedWeekDayPlan[] = targetDates.map((date, i) => {
      const meal = sharedWeek[i];
      if (!meal) {
        return {
          date,
          mealTitle: "(ufyllt — pin-pool tom)",
          mealId: "",
          unfilled: true,
        };
      }
      return {
        date,
        mealTitle: meal.title,
        mealId: meal._id,
      };
    });

    const usagePatchKeys = new Set<string>();
    const writes: Array<{ tier: PlanTier; dayIndex: number }> = [];

    for (const tier of tiersProcessed) {
      const existingDates = existingDatesByTier.get(tier) ?? new Set<string>();
      for (let i = 0; i < targetDates.length; i += 1) {
        if (!sharedWeek[i]) continue;
        if (!existingDates.has(targetDates[i]!)) {
          writes.push({ tier, dayIndex: i });
        }
      }
    }

    if (opts.dryRun) {
      menuDaysCreated = writes.length;
      return {
        targetWeek: targetWeekMonday,
        providerRef,
        providerSlug,
        tiersProcessed,
        menuDaysCreated,
        menuDaysSkipped,
        errors,
        sharedWeekPlan,
      };
    }

    if (writes.length === 0) {
      return {
        targetWeek: targetWeekMonday,
        providerRef,
        providerSlug,
        tiersProcessed,
        menuDaysCreated: 0,
        menuDaysSkipped,
        errors,
        sharedWeekPlan,
      };
    }

    let tx = write!.transaction();

    for (const { tier, dayIndex } of writes) {
      const date = targetDates[dayIndex]!;
      const meal = sharedWeek[dayIndex];
      if (!meal) continue;

      tx = tx.createOrReplace(buildMenuDayCreatePayload(providerRef, date, tier, meal, stamp));

      const usageKey = `${meal._id}:${date}`;
      if (!usagePatchKeys.has(usageKey)) {
        usagePatchKeys.add(usageKey);
        tx = tx.patch(meal._id, {
          set: { lastUsedDate: date },
          inc: { usageCount: 1 },
        });
      }
    }

    await tx.commit({ autoGenerateArrayKeys: true });
    menuDaysCreated = writes.length;

    return {
      targetWeek: targetWeekMonday,
      providerRef,
      providerSlug,
      tiersProcessed,
      menuDaysCreated,
      menuDaysSkipped,
      errors,
      sharedWeekPlan,
    };
  } catch (e: unknown) {
    errors.push(String((e as Error)?.message ?? e));
    return {
      targetWeek: targetWeekMonday,
      providerRef,
      providerSlug,
      tiersProcessed,
      menuDaysCreated,
      menuDaysSkipped,
      errors,
    };
  }
}
