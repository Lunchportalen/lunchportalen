import type { SanityClient } from "@sanity/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
import { addDaysISO, isIsoDate, nowISO } from "@/lib/date/oslo";

import {
  mondayToFridayIso,
  startOfWeekMondayNPlus3,
  utcInstantToOsloDateISO,
} from "./calendar";
import { generateWeekMenu, type PlanTier } from "./generateWeekMenu";
import {
  fetchMealIdeaBank,
  hasCompleteNutrition,
  normalizeMenuTitleKey,
} from "./mealIdeaBankQuery";

const MENU_DAY_CATEGORY = "varmrett" as const;

/** Sanity menuDay schema: BASIS + LUXUS only (Patch 12 / Patch 2.1 fail-closed). */
const ORDERED_PLAN_TIERS: PlanTier[] = ["BASIS", "LUXUS"];

export type MenuWeekRolloutResult = {
  targetWeek: string;
  /** Eksplisitt provider-scope brukt for hele rollouten (Sanity provider._ref == Supabase providers.id). */
  providerRef: string;
  providerSlug: string | null;
  tiersProcessed: PlanTier[];
  menuDaysCreated: number;
  menuDaysSkipped: number;
  errors: string[];
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

  return ORDERED_PLAN_TIERS.filter((t) => seen.has(t));
}

async function fetchExistingMenuDaysForWeek(
  sanity: SanityClient,
  providerRef: string,
  dates: string[],
  tier: PlanTier,
): Promise<Array<{ date?: string | null; mealTitle?: string | null }>> {
  const rows = await sanity.fetch<Array<{ date?: string | null; mealTitle?: string | null }>>(
    `*[
      _type == "menuDay" &&
      provider._ref == $providerRef &&
      date in $dates &&
      planTier == $tier &&
      category == $category &&
      !(_id in path("drafts.**"))
    ]{ date, mealTitle }`,
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

  for (const tier of tiersProcessed) {
    try {
      const existing = await fetchExistingMenuDaysForWeek(opts.sanityRead, providerRef, targetDates, tier);
      const existingDates = new Set(
        existing.map((r) => String(r.date ?? "").trim()).filter((d) => targetDates.includes(d)),
      );

      menuDaysSkipped += existingDates.size;

      const missingIdx: number[] = [];
      for (let i = 0; i < targetDates.length; i += 1) {
        if (!existingDates.has(targetDates[i])) missingIdx.push(i);
      }

      if (missingIdx.length === 0) {
        continue;
      }

      const avoidTitles = await fetchCooldownTitleKeys(opts.sanityRead, providerRef, targetWeekMonday);
      for (const row of existing) {
        const k = normalizeMenuTitleKey(row.mealTitle ?? "");
        if (k) avoidTitles.add(k);
      }

      const [baseMealsRaw, fridayMealsRaw] = await Promise.all([
        fetchMealIdeaBank(opts.sanityRead, tier, false, instant),
        fetchMealIdeaBank(opts.sanityRead, tier, true, instant),
      ]);

      const baseMeals = baseMealsRaw.filter(hasCompleteNutrition);
      const fridayMeals = fridayMealsRaw.filter(hasCompleteNutrition);

      if (baseMeals.length < 50) {
        throw new Error(
          `For få retter med komplett næringsinnhold for ${tier}: ${baseMeals.length} (minimum 50).`,
        );
      }

      const week = generateWeekMenu({ baseMeals, fridayMeals, avoidTitles, planTier: tier });
      if (week.length !== 5) {
        throw new Error(`generateWeekMenu returnerte ${week.length} dager for ${tier}, forventet 5.`);
      }

      const bad = week.find((m) => !hasCompleteNutrition(m));
      if (bad) {
        throw new Error(`Retten «${bad.title}» mangler komplett næring for ${tier}.`);
      }

      if (opts.dryRun) {
        menuDaysCreated += missingIdx.length;
        continue;
      }

      let tx = write!.transaction();
      for (const i of missingIdx) {
        const date = targetDates[i];
        const meal = week[i];
        const _id = docIdMenuDay(providerRef, date, tier);

        tx = tx.createOrReplace({
          _id,
          _type: "menuDay",
          provider: { _type: "reference" as const, _ref: providerRef },
          date,
          planTier: tier,
          category: MENU_DAY_CATEGORY,
          mealRef: { _type: "reference", _ref: meal._id },
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
        });

        tx = tx.patch(meal._id, {
          set: { lastUsedDate: date },
          inc: { usageCount: 1 },
        });
      }

      await tx.commit({ autoGenerateArrayKeys: true });
      menuDaysCreated += missingIdx.length;
    } catch (e: unknown) {
      errors.push(`[${tier}] ${String((e as Error)?.message ?? e)}`);
    }
  }

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
