import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Flex, Grid, Spinner, Stack, Text } from "@sanity/ui";
import { useClient } from "sanity";
import { IntentLink } from "sanity/router";

import { melhusProviderReference } from "../../lib/melhusProvider";
import { generateWeekMenu, type Meal, type NutritionPer100g, type PlanTier } from "./generateWeekMenu";

const TARGET_PRICE = 90;
const DEFAULT_CATEGORY = "varmrett";

const PLAN_TIERS: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];
type MenuCategory = "paasmurt" | "salat" | "sushi" | "pokebowl" | "thai" | "varmrett";

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+med\b.*$/, "")
    .replace(/\s+\d+$/, "");
}

type DayDoc = {
  _id: string;
  date: string;
  planTier?: PlanTier | null;
  category?: MenuCategory | null;
  description?: string;
  mealTitle?: string;
  mealRef?: { _ref: string; _type: "reference" };
  allergens?: string[];
  mayContain?: string[];
  nutritionPer100g?: NutritionPer100g | null;
  kitchenStyle?: string;
  costTier?: string;
  estimatedCostPerPortion?: number;
  isFishDish?: boolean;
  isSoup?: boolean;
  isVegetarian?: boolean;
  approvedForPublish?: boolean;
  approvedAt?: string;
  customerVisible?: boolean;
  customerVisibleSetAt?: string;
};

function hasCompleteNutrition(meal: Meal): boolean {
  const n = meal.nutritionPer100g;
  return (
    !!n &&
    typeof n.energyKcal === "number" &&
    typeof n.proteinG === "number" &&
    typeof n.carbohydratesG === "number" &&
    typeof n.fatG === "number" &&
    typeof n.saltG === "number"
  );
}

function isoFromDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function osloTodayISO() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function startOfWeekISO(osloISO: string) {
  const d = new Date(`${osloISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return isoFromDate(d);
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoFromDate(d);
}

function weekdayDates(mondayISO: string) {
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(mondayISO, i));
}

function docIdForDate(date: string, planTier: PlanTier, category: MenuCategory = DEFAULT_CATEGORY) {
  return `menuDay-${date}-${planTier}-${category}`;
}

function matchesMenuDayTier(doc: Pick<DayDoc, "_id" | "planTier" | "date">, tier: PlanTier, dates?: string[]) {
  if (dates && !dates.includes(doc.date)) return false;
  if (doc.planTier === tier) return true;
  const t = doc.planTier;
  if ((t === undefined || t === null) && tier === "BASIS") {
    return doc._id.includes("-BASIS-");
  }
  return false;
}

function pickCacheKey(label: "uke1" | "uke2", tier: PlanTier) {
  return `${label}:${tier}`;
}

function costTierClause(includePremium: boolean) {
  return includePremium
    ? `costTier in ["BUDGET", "STANDARD", "PREMIUM"]`
    : `costTier in ["BUDGET", "STANDARD"]`;
}

function currentSeason(): "winter" | "spring" | "summer" | "autumn" {
  const month = new Date().getMonth() + 1;
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

function formatNordicDate(iso: string) {
  const [yyyy, mm, dd] = iso.split("-");
  return yyyy && mm && dd ? `${dd}.${mm}.${yyyy}` : iso;
}

function formatList(values?: string[]) {
  return Array.isArray(values) && values.length ? values.join(", ") : "—";
}

function formatMoney(value?: number) {
  return typeof value === "number" ? `${value} kr` : "—";
}

function formatMargin(cost?: number) {
  return typeof cost === "number" ? `${TARGET_PRICE - cost} kr` : "—";
}

function renderNutrition(nutrition?: NutritionPer100g | null) {
  if (!nutrition) return "Næring: —";

  const kcal =
    typeof nutrition.energyKcal === "number" ? `${nutrition.energyKcal} kcal` : "— kcal";
  const protein =
    typeof nutrition.proteinG === "number" ? `protein ${nutrition.proteinG}g` : "protein —";
  const carbs =
    typeof nutrition.carbohydratesG === "number"
      ? `karbohydrat ${nutrition.carbohydratesG}g`
      : "karbohydrat —";
  const fat = typeof nutrition.fatG === "number" ? `fett ${nutrition.fatG}g` : "fett —";
  const salt = typeof nutrition.saltG === "number" ? `salt ${nutrition.saltG}g` : "salt —";

  return `Næring pr. 100g: ${kcal} · ${protein} · ${carbs} · ${fat} · ${salt}`;
}

export default function WeekPlanner() {
  const client = useClient({ apiVersion: "2024-01-01" });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [week1, setWeek1] = useState<DayDoc[]>([]);
  const [week2, setWeek2] = useState<DayDoc[]>([]);
  const [activeTier, setActiveTier] = useState<PlanTier>("BASIS");

  const lastPicked = React.useRef<Record<string, Set<string>>>({});
  const ranges = useMemo(() => {
    const week1Start = startOfWeekISO(osloTodayISO());
    const week2Start = addDaysISO(week1Start, 7);

    return {
      week1: { dates: weekdayDates(week1Start) },
      week2: { dates: weekdayDates(week2Start) },
    };
  }, []);

  const fetchWeeks = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const query = `*[
        _type == "menuDay" &&
        date in $dates &&
        !(_id in path("drafts.**"))
      ] | order(date asc) {
        _id,
        date,
        planTier,
        category,
        description,
        mealTitle,
        mealRef,
        allergens,
        mayContain,
        nutritionPer100g,
        kitchenStyle,
        costTier,
        estimatedCostPerPortion,
        isFishDish,
        isSoup,
        isVegetarian,
        approvedForPublish,
        approvedAt,
        customerVisible,
        customerVisibleSetAt
      }`;

      const [w1, w2] = await Promise.all([
        client.fetch<DayDoc[]>(query, { dates: ranges.week1.dates }),
        client.fetch<DayDoc[]>(query, { dates: ranges.week2.dates }),
      ]);

      setWeek1(w1 || []);
      setWeek2(w2 || []);
    } catch (error: any) {
      console.error(error);
      setMsg(`Kunne ikke hente ukeplan: ${error?.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [client, ranges]);

  useEffect(() => {
    void fetchWeeks();
  }, [fetchWeeks]);

  const fetchMealBank = useCallback(
    async (tier: PlanTier, includePremium: boolean): Promise<Meal[]> => {
      const season = currentSeason();
      const costPart = costTierClause(includePremium);
      const enterpriseOnly =
        tier === "ENTERPRISE"
          ? `count(allowedPlanTiers) == 1 && allowedPlanTiers[0] == "ENTERPRISE"`
          : `$tier in allowedPlanTiers`;
      const costCap =
        tier === "ENTERPRISE"
          ? `defined(estimatedCostPerPortion)`
          : `defined(estimatedCostPerPortion) && estimatedCostPerPortion < ${TARGET_PRICE}`;

      const meals = await client.fetch<Meal[]>(
        `*[
          _type == "mealIdea" &&
          isActive == true &&
          ${costCap} &&
          ${enterpriseOnly} &&
          ${costPart} &&
          (!defined(season) || count(season) == 0 || $season in season)
        ] {
          _id,
          title,
          description,
          tags,
          costTier,
          productionComplexity,
          nutritionScore,
          allergens,
          mayContain,
          nutritionPer100g,
          nutritionNote,
          isActive,
          season,
          kitchenStyle,
          method,
          estimatedCostPerPortion,
          targetPricePerPortion,
          isFishDish,
          isSoup,
          isVegetarian,
          lastUsedDate,
          usageCount
        }`,
        tier === "ENTERPRISE" ? { season } : { season, tier }
      );

      const safeMeals = meals || [];

      if (process.env.NODE_ENV === "development") {
        console.log("[WeekPlanner] mealIdeas", {
          tier,
          includePremium,
          count: safeMeals.length,
          withAllergens: safeMeals.filter((m) => (m.allergens || []).length > 0).length,
          withNutrition: safeMeals.filter((m) => !!m.nutritionPer100g).length,
          withCompleteNutrition: safeMeals.filter(hasCompleteNutrition).length,
        });
      }

      return safeMeals;
    },
    [client]
  );

  const fetchCooldownTitles = useCallback(
    async (mondayISO: string): Promise<Set<string>> => {
      const from = addDaysISO(mondayISO, -28);
      const to = addDaysISO(mondayISO, -1);

      const rows = await client.fetch<Array<{ mealTitle?: string; description?: string }>>(
        `*[
          _type == "menuDay" &&
          date >= $from &&
          date <= $to &&
          !(_id in path("drafts.**"))
        ] { mealTitle, description }`,
        { from, to }
      );

      return new Set(
        (rows || [])
          .map((r) => normalizeTitle(r.mealTitle || r.description || ""))
          .filter(Boolean)
      );
    },
    [client]
  );

  const ensureWeek = useCallback(
    async (dates: string[], tier: PlanTier) => {
      for (const date of dates) {
        await client.createIfNotExists({
          _id: docIdForDate(date, tier),
          _type: "menuDay",
          provider: melhusProviderReference(),
          date,
          planTier: tier,
          category: DEFAULT_CATEGORY,
          description: "",
          mealTitle: "",
          allergens: [],
          mayContain: [],
          approvedForPublish: false,
          customerVisible: false,
        });
      }
    },
    [client]
  );

  const autoFillWeek = useCallback(
    async (dates: string[], label: "uke1" | "uke2") => {
      setBusy(`autofill-${label}`);
      setMsg(null);
      const tier = activeTier;

      try {
        await ensureWeek(dates, tier);

        const existingDocs = label === "uke1" ? week1 : week2;
        const tierDocs = existingDocs.filter((d) => matchesMenuDayTier(d, tier, dates));
        if (tierDocs.some((d) => d.approvedForPublish)) {
          throw new Error("Uken er allerede godkjent for valgt tier. Auto-fyll er sperret.");
        }

        const [baseMealsRaw, fridayMealsRaw, avoidTitles] = await Promise.all([
          fetchMealBank(tier, false),
          fetchMealBank(tier, true),
          fetchCooldownTitles(dates[0]),
        ]);

        const baseMeals = baseMealsRaw.filter(hasCompleteNutrition);
        const fridayMeals = fridayMealsRaw.filter(hasCompleteNutrition);

        if (baseMeals.length < 50) {
          throw new Error(
            `For få retter med komplett næringsinnhold for ${tier}: ${baseMeals.length}. Importer/oppdater varmmatbanken før auto-fyll.`
          );
        }

        const otherLabel = label === "uke1" ? "uke2" : "uke1";
        const otherWeekDocs = label === "uke1" ? week2 : week1;

        for (const doc of otherWeekDocs) {
          if (!matchesMenuDayTier(doc, tier)) continue;
          const title = normalizeTitle(doc.mealTitle || doc.description || "");
          if (title) avoidTitles.add(title);
        }

        const otherKey = pickCacheKey(otherLabel, tier);
        const otherPicked = lastPicked.current[otherKey];
        if (otherPicked) {
          for (const title of otherPicked) {
            avoidTitles.add(title);
          }
        }

        const picked = generateWeekMenu({ baseMeals, fridayMeals, avoidTitles, planTier: tier });

        if (picked.length !== 5) {
          throw new Error("Generator returnerte ikke 5 hverdager.");
        }

        const missingNutrition = picked.find((meal) => !hasCompleteNutrition(meal));
        if (missingNutrition) {
          throw new Error(`Retten "${missingNutrition.title}" mangler næringsinnhold per 100g.`);
        }

        const cacheKey = pickCacheKey(label, tier);
        lastPicked.current[cacheKey] = new Set(picked.map((m) => normalizeTitle(m.title)));

        if (process.env.NODE_ENV === "development") {
          console.log(`[WeekPlanner] valgt ${label} tier=${tier}`, picked);
        }

        const now = new Date().toISOString();
        let transaction = client.transaction();

        for (let i = 0; i < dates.length; i += 1) {
          const date = dates[i];
          const meal = picked[i];
          const docId = docIdForDate(date, tier);

          transaction = transaction
            .patch(docId, {
              unset: ["nutritionPer100g", "approvedAt", "customerVisibleSetAt"],
            })
            .patch(docId, {
              set: {
                description: meal.description?.trim() || meal.title,
                planTier: tier,
                category: DEFAULT_CATEGORY,
                mealTitle: meal.title,
                mealRef: {
                  _type: "reference",
                  _ref: meal._id,
                },
                allergens: meal.allergens ?? [],
                mayContain: meal.mayContain ?? [],
                nutritionPer100g: meal.nutritionPer100g,
                kitchenStyle: meal.kitchenStyle,
                costTier: meal.costTier,
                estimatedCostPerPortion: meal.estimatedCostPerPortion,
                isFishDish: meal.isFishDish === true,
                isSoup: meal.isSoup === true,
                isVegetarian: meal.isVegetarian === true,
                approvedForPublish: false,
                customerVisible: false,
              },
            });

          transaction = transaction.patch(meal._id, {
            set: { lastUsedDate: date },
            inc: { usageCount: 1 },
          });
        }

        await transaction.commit({ autoGenerateArrayKeys: true });

        setMsg(`Auto-fyll fullført (${tier}) ${now}: næring og allergener er kopiert automatisk.`);
        await fetchWeeks();
      } catch (error: any) {
        console.error(error);
        setMsg(`Auto-fyll stoppet: ${error?.message || String(error)}`);
      } finally {
        setBusy(null);
      }
    },
    [activeTier, client, ensureWeek, fetchWeeks, fetchMealBank, fetchCooldownTitles, week1, week2]
  );

  const approveWeek2 = useCallback(async () => {
    setBusy("approve");
    setMsg(null);

    try {
      await ensureWeek(ranges.week2.dates, activeTier);

      const fetched = await client.fetch<DayDoc[]>(
        `*[
          _type == "menuDay" &&
          date in $dates &&
          !(_id in path("drafts.**"))
        ] | order(date asc) {
          _id,
          date,
          planTier,
          description,
          mealTitle,
          allergens,
          nutritionPer100g
        }`,
        { dates: ranges.week2.dates }
      );

      const docs = (fetched || []).filter((d) => matchesMenuDayTier(d, activeTier, ranges.week2.dates));

      if (docs.length !== 5) {
        throw new Error(
          `Uke 2 må ha nøyaktig 5 hverdager for valgt tier (${activeTier}). Har ${docs.length}/5. Opprett manglende dager først.`
        );
      }
      if (docs.some((day) => !day.description || day.description.trim().length < 8)) {
        throw new Error("Alle dager i uke 2 må ha menybeskrivelse før godkjenning.");
      }

      const missingNutrition = docs.find((day) => !day.nutritionPer100g);
      if (missingNutrition) {
        throw new Error(
          `${formatNordicDate(missingNutrition.date)} mangler næringsinnhold og kan ikke godkjennes.`
        );
      }

      const now = new Date().toISOString();
      let transaction = client.transaction();

      for (const day of docs) {
        transaction = transaction.patch(day._id, {
          set: { approvedForPublish: true, approvedAt: now },
        });
      }

      await transaction.commit({ autoGenerateArrayKeys: true });
      setMsg(`Uke 2 er godkjent (${activeTier}). Synlighet styres videre av automatikk/cron.`);
      await fetchWeeks();
    } catch (error: any) {
      console.error(error);
      setMsg(`Godkjenning stoppet: ${error?.message || String(error)}`);
    } finally {
      setBusy(null);
    }
  }, [activeTier, client, ensureWeek, fetchWeeks, ranges.week2.dates]);

  const revokeWeek2 = useCallback(async () => {
    setBusy("revoke");
    setMsg(null);

    try {
      const tierDocs = week2.filter((d) => matchesMenuDayTier(d, activeTier, ranges.week2.dates));
      if (tierDocs.length === 0) {
        setMsg("Ingen menuDay-dokumenter for valgt tier i uke 2.");
        return;
      }

      let transaction = client.transaction();

      for (const day of tierDocs) {
        transaction = transaction.patch(day._id, {
          set: { approvedForPublish: false, customerVisible: false },
          unset: ["approvedAt", "customerVisibleSetAt"],
        });
      }

      await transaction.commit({ autoGenerateArrayKeys: true });
      setMsg(`Godkjenning for uke 2 (${activeTier}) er trukket tilbake.`);
      await fetchWeeks();
    } catch (error: any) {
      console.error(error);
      setMsg(`Kunne ikke trekke godkjenning: ${error?.message || String(error)}`);
    } finally {
      setBusy(null);
    }
  }, [activeTier, client, fetchWeeks, ranges.week2.dates, week2]);

  const createWeek = useCallback(
    async (dates: string[], label: string) => {
      setBusy(`create-${label}`);
      setMsg(null);

      try {
        await ensureWeek(dates, activeTier);
        setMsg(`${label} er opprettet for ${activeTier}.`);
        await fetchWeeks();
      } catch (error: any) {
        console.error(error);
        setMsg(`Kunne ikke opprette ${label}: ${error?.message || String(error)}`);
      } finally {
        setBusy(null);
      }
    },
    [activeTier, ensureWeek, fetchWeeks]
  );

  const filteredWeek1 = useMemo(
    () => week1.filter((d) => matchesMenuDayTier(d, activeTier, ranges.week1.dates)),
    [activeTier, ranges.week1.dates, week1]
  );

  const filteredWeek2 = useMemo(
    () => week2.filter((d) => matchesMenuDayTier(d, activeTier, ranges.week2.dates)),
    [activeTier, ranges.week2.dates, week2]
  );

  const stats = useMemo(
    () => ({
      w1Approved: filteredWeek1.filter((d) => d.approvedForPublish).length,
      w1Visible: filteredWeek1.filter((d) => d.customerVisible).length,
      w2Approved: filteredWeek2.filter((d) => d.approvedForPublish).length,
      w2Visible: filteredWeek2.filter((d) => d.customerVisible).length,
    }),
    [filteredWeek1, filteredWeek2]
  );

  const renderWeek = (title: string, docs: DayDoc[], dates: string[]) => {
    const byDate = new Map(docs.map((day) => [day.date, day]));

    return (
      <Card padding={3} radius={2} shadow={1}>
        <Stack space={2}>
          <Text weight="semibold">{title}</Text>

          {dates.map((date) => {
            const day = byDate.get(date);

            return (
              <Card key={date} padding={3} radius={2} tone="transparent" border>
                <Stack space={3}>
                  <Flex justify="space-between" align="center" gap={3}>
                    <Text weight="semibold">{formatNordicDate(date)}</Text>

                    <Flex gap={2} wrap="wrap">
                      <Badge tone={day?.approvedForPublish ? "positive" : "caution"}>
                        {day?.approvedForPublish ? "Godkjent" : "Ikke godkjent"}
                      </Badge>
                      <Badge tone={day?.customerVisible ? "positive" : "default"}>
                        {day?.customerVisible ? "Synlig" : "Skjult"}
                      </Badge>
                      {day?.isFishDish ? <Badge tone="primary">Fisk</Badge> : null}
                      {day?.isSoup ? <Badge tone="primary">Suppe</Badge> : null}
                      {day?.isVegetarian ? <Badge tone="positive">Vegetar</Badge> : null}
                    </Flex>
                  </Flex>

                  <Stack space={2}>
                    <Text size={1} weight="semibold">
                      {day?.mealTitle || "Ingen rett valgt"}
                    </Text>

                    <Text size={1}>{day?.description || "—"}</Text>

                    <Text size={1} muted>
                      Allergener: {formatList(day?.allergens)}
                    </Text>

                    <Text size={1} muted>
                      Kan inneholde spor av: {formatList(day?.mayContain)}
                    </Text>

                    <Text size={1} muted>
                      {renderNutrition(day?.nutritionPer100g)}
                    </Text>

                    <Text size={1} muted>
                      Kjøkkenstil: {day?.kitchenStyle || "—"} · Kostnadsnivå:{" "}
                      {day?.costTier || "—"}
                    </Text>

                    <Text size={1} muted>
                      Råvarekost: {formatMoney(day?.estimatedCostPerPortion)} · Margin mot 90 kr:{" "}
                      {formatMargin(day?.estimatedCostPerPortion)}
                    </Text>
                  </Stack>

                  {day?._id ? (
                    <IntentLink intent="edit" params={{ id: day._id, type: "menuDay" }}>
                      <Button text="Rediger" mode="ghost" />
                    </IntentLink>
                  ) : (
                    <Text size={1} muted>
                      Dagen er ikke opprettet ennå.
                    </Text>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Card>
    );
  };

  return (
    <Stack space={4} padding={4}>
      <Card padding={4} radius={2} shadow={1} tone="transparent">
        <Stack space={3}>
          <Flex justify="space-between" align="center" gap={4} wrap="wrap">
            <Stack space={1}>
              <Text weight="semibold" size={2}>
                Ukeplan
              </Text>
              <Text size={1} muted>
                Lunchportalen bruker kun mandag–fredag. Helg bestilles via Melhus Catering.
              </Text>
            </Stack>

            <Flex gap={2} wrap="wrap">
              <Button text="Opprett uke 1" disabled={!!busy || loading} onClick={() => createWeek(ranges.week1.dates, "Uke 1")} />
              <Button text="Opprett uke 2" disabled={!!busy || loading} onClick={() => createWeek(ranges.week2.dates, "Uke 2")} />
              <Button text={busy === "autofill-uke1" ? "Fyller uke 1..." : "Auto-fyll uke 1"} disabled={!!busy || loading} onClick={() => autoFillWeek(ranges.week1.dates, "uke1")} />
              <Button text={busy === "autofill-uke2" ? "Fyller uke 2..." : "Auto-fyll uke 2"} disabled={!!busy || loading} onClick={() => autoFillWeek(ranges.week2.dates, "uke2")} />
              <Button tone="positive" text={busy === "approve" ? "Godkjenner..." : "Godkjenn uke 2"} disabled={!!busy || loading} onClick={approveWeek2} />
              <Button tone="critical" text={busy === "revoke" ? "Opphever..." : "Trekk godkjenning"} disabled={!!busy || loading || filteredWeek2.length === 0} onClick={revokeWeek2} />
              <Button text="Oppdater" disabled={!!busy || loading} onClick={fetchWeeks} />
            </Flex>
          </Flex>

          <Flex gap={2} wrap="wrap" align="center">
            <Text size={1} weight="semibold">
              Avtale-tier
            </Text>
            {PLAN_TIERS.map((tier) => (
              <Button
                key={tier}
                mode={activeTier === tier ? "default" : "ghost"}
                tone={activeTier === tier ? "primary" : "default"}
                text={tier === "BASIS" ? "Basis" : tier === "LUXUS" ? "Luxus" : "Enterprise"}
                disabled={!!busy || loading}
                onClick={() => setActiveTier(tier)}
              />
            ))}
          </Flex>

          <Flex gap={2} wrap="wrap">
            <Badge tone={stats.w1Approved === 5 ? "positive" : "caution"}>Uke 1 godkjent: {stats.w1Approved}/5</Badge>
            <Badge tone={stats.w1Visible > 0 ? "positive" : "default"}>Uke 1 synlig: {stats.w1Visible}/5</Badge>
            <Badge tone={stats.w2Approved === 5 ? "positive" : "caution"}>Uke 2 godkjent: {stats.w2Approved}/5</Badge>
            <Badge tone={stats.w2Visible > 0 ? "positive" : "default"}>Uke 2 synlig: {stats.w2Visible}/5</Badge>
            <Badge>Uke 1: {formatNordicDate(ranges.week1.dates[0])} → {formatNordicDate(ranges.week1.dates[4])}</Badge>
            <Badge>Uke 2: {formatNordicDate(ranges.week2.dates[0])} → {formatNordicDate(ranges.week2.dates[4])}</Badge>
          </Flex>

          {msg ? (
            <Card padding={3} radius={2} border tone="transparent">
              <Text size={1}>{msg}</Text>
            </Card>
          ) : null}

          {loading ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1} muted>Laster ukeplan…</Text>
            </Flex>
          ) : (
            <Grid columns={[1, 1, 2]} gap={4}>
              {renderWeek(`Denne uken (Uke 1) · ${activeTier}`, filteredWeek1, ranges.week1.dates)}
              {renderWeek(`Neste uke (Uke 2) · ${activeTier}`, filteredWeek2, ranges.week2.dates)}
            </Grid>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}