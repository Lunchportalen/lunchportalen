import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Stack, Text, Button, Grid, Flex, Badge, Spinner } from "@sanity/ui";
import { useClient } from "sanity";
import { IntentLink } from "sanity/router";

type MenuDoc = {
  _id: string;
  date: string; // YYYY-MM-DD
  description?: string;
  allergens?: string[];
  isPublished?: boolean;
};

type Meal = {
  _id: string;
  title: string;
  tags: string[];
  costTier: "BUDGET" | "STANDARD" | "PREMIUM";
  nutritionScore?: number;
  allergens?: string[];
  isActive?: boolean;
  season?: string[];
};

function isoFromDate(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** ✅ Studio-visning: ISO (YYYY-MM-DD) -> DD-MM-YYYY */
function formatNordicDate(iso: string) {
  if (!iso) return "";
  const [yyyy, mm, dd] = iso.split("-");
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}-${mm}-${yyyy}`;
}

/** ✅ Studio-visning: ISO datetime (YYYY-MM-DDTHH:mm...) -> DD-MM-YYYYTHH:mm */
function formatNordicDateTime(isoDT: string) {
  if (!isoDT) return "";
  const date = isoDT.slice(0, 10);
  const time = isoDT.slice(11, 16);
  const d = formatNordicDate(date);
  return time ? `${d} ${time}` : d;
}

/** Oslo "i dag" som YYYY-MM-DD */
function osloTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Ukedag-index (Mon=0..Sun=6) i Oslo basert på dateISO */
function osloWeekdayIndex(dateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoFromDate(d);
}

function weekStartMondayISO(todayISO: string) {
  const idx = osloWeekdayIndex(todayISO);
  return addDaysISO(todayISO, -idx);
}

function weekDates(mondayISO: string) {
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(mondayISO, i));
}

/** ✅ Label: "man. · DD-MM-YYYY" */
function labelForISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  return `${wd} · ${formatNordicDate(dateISO)}`;
}

/** Uke 2 unlock: torsdag 08:00 i uke 1 (Europe/Oslo) */
function unlockAtForWeek2(mondayISO: string) {
  const thuISO = addDaysISO(mondayISO, 3);
  return `${thuISO}T08:00`;
}

function nowOsloHM() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dateISO = `${get("year")}-${get("month")}-${get("day")}`;
  const timeHM = `${get("hour")}:${get("minute")}`;
  return { dateISO, timeHM };
}

function isWeek2Unlocked(mondayISO: string) {
  const { dateISO, timeHM } = nowOsloHM();
  const thuISO = addDaysISO(mondayISO, 3);
  if (dateISO < thuISO) return false;
  if (dateISO > thuISO) return true;
  return timeHM >= "08:00";
}

function docIdForDate(dateISO: string) {
  return `menuContent-${dateISO}`;
}

function hasTag(m: Meal, tag: string) {
  return Array.isArray(m.tags) && m.tags.includes(tag);
}

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUnique(list: Meal[], usedTitles: Set<string>) {
  const candidates = list.filter((m) => !!m?.title && !usedTitles.has(m.title));
  return pickRandom(candidates);
}

function currentSeason(): "winter" | "spring" | "summer" | "autumn" {
  const m = new Date().getMonth() + 1;
  if (m === 12 || m === 1 || m === 2) return "winter";
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  return "autumn";
}

/**
 * Idiotsikker ukeplan med Fredagsregel:
 * - Tir=fisk, Ons=suppe, Tor=veg
 * - Man = suppler (base)
 * - Fre = suppler (fredagspool) – prøver PREMIUM først
 */
function buildWeekPlan5WithFriday(mealsBase: Meal[], mealsFriday: Meal[], avoidTitles: Set<string>) {
  const used = new Set<string>(avoidTitles);

  const fish = mealsBase.filter((m) => hasTag(m, "fish"));
  const soup = mealsBase.filter((m) => hasTag(m, "soup"));
  const veg = mealsBase.filter((m) => hasTag(m, "veg"));

  const restBase = mealsBase.filter((m) => !hasTag(m, "fish") && !hasTag(m, "soup") && !hasTag(m, "veg"));
  const restFriday = mealsFriday.filter((m) => !hasTag(m, "fish") && !hasTag(m, "soup") && !hasTag(m, "veg"));

  // Hard-validering
  if (fish.length < 5) throw new Error("Rett-bank: for få fiskeretter (base).");
  if (soup.length < 5) throw new Error("Rett-bank: for få supperetter (base).");
  if (veg.length < 5) throw new Error("Rett-bank: for få vegetarretter (base).");
  if (restBase.length < 10) throw new Error("Rett-bank: for få suppleringsretter (base).");
  if (restFriday.length < 10) throw new Error("Rett-bank: for få suppleringsretter (fredag).");

  const fishPick = pickUnique(fish, used);
  if (!fishPick) throw new Error("Kunne ikke velge fisk (cooldown).");
  used.add(fishPick.title);

  const soupPick = pickUnique(soup, used);
  if (!soupPick) throw new Error("Kunne ikke velge suppe (cooldown).");
  used.add(soupPick.title);

  const vegPick = pickUnique(veg, used);
  if (!vegPick) throw new Error("Kunne ikke velge vegetar (cooldown).");
  used.add(vegPick.title);

  const monPick = pickUnique(restBase, used);
  if (!monPick) throw new Error("Kunne ikke velge suppleringsrett (mandag).");
  used.add(monPick.title);

  // Fredagsregel: prøv PREMIUM først, ellers fredagspool, ellers base-pool
  const fridayPremium = restFriday.filter((m) => m.costTier === "PREMIUM");
  let friPick = pickUnique(fridayPremium, used);

  if (!friPick) friPick = pickUnique(restFriday, used);
  if (!friPick) friPick = pickUnique(restBase, used);
  if (!friPick) throw new Error("Kunne ikke velge suppleringsrett (fredag).");
  used.add(friPick.title);

  // Man, Tir, Ons, Tor, Fre
  return [monPick, fishPick, soupPick, vegPick, friPick];
}

export default function WeekPlannerTool() {
  const client = useClient({ apiVersion: "2024-01-01" });

  const todayISO = useMemo(() => osloTodayISO(), []);
  const mondayA = useMemo(() => weekStartMondayISO(todayISO), [todayISO]);
  const mondayB = useMemo(() => addDaysISO(mondayA, 7), [mondayA]);
  const mondayC = useMemo(() => addDaysISO(mondayA, 14), [mondayA]);

  const weekA = useMemo(() => weekDates(mondayA), [mondayA]);
  const weekB = useMemo(() => weekDates(mondayB), [mondayB]);
  const weekC = useMemo(() => weekDates(mondayC), [mondayC]);

  const unlockAt = useMemo(() => unlockAtForWeek2(mondayA), [mondayA]);
  const unlocked = useMemo(() => isWeek2Unlocked(mondayA), [mondayA]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<Record<string, MenuDoc | undefined>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const [bankStats, setBankStats] = useState<{
    totalBase: number;
    fish: number;
    soup: number;
    veg: number;
    restBase: number;
    fridayTotal: number;
    fridayPremium: number;
  } | null>(null);

  const allDates = useMemo(() => [...weekA, ...weekB, ...weekC], [weekA, weekB, weekC]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const q = `*[_type=="menuContent" && date in $dates]{
        _id, date, description, allergens, isPublished
      }`;
      const res = await client.fetch<MenuDoc[]>(q, { dates: allDates });
      const map: Record<string, MenuDoc> = {};
      for (const d of res) map[d.date] = d;
      setDocs(map);
    } catch (e: any) {
      setMsg("Kunne ikke hente meny-dokumenter. Sjekk konsollen.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [client, allDates]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const ensureDates = useCallback(
    async (dates: string[]) => {
      for (const dateISO of dates) {
        const _id = docIdForDate(dateISO);
        await client.createIfNotExists({
          _id,
          _type: "menuContent",
          date: dateISO,
          description: "",
          allergens: [],
          isPublished: false,
        });
      }
    },
    [client]
  );

  // 🔒 LOCK HELPERS
  const isWeekPublished = useCallback(
    (dates: string[]) => dates.some((d) => !!docs[d]?.isPublished),
    [docs]
  );

  const canGenerateWeek3Now = useMemo(() => isWeek2Unlocked(mondayA), [mondayA]);

  // Base-bank (man–tor): BUDGET+STANDARD
  const fetchMealBankBase = useCallback(async () => {
    const season = currentSeason();
    const q = `*[_type=="mealIdea"
      && isActive == true
      && costTier in ["BUDGET","STANDARD"]
      && (nutritionScore >= 7 || !defined(nutritionScore))
      && (!defined(season) || $season in season)
    ]{
      _id, title, tags, costTier, nutritionScore, allergens, season
    }`;
    return (await client.fetch<Meal[]>(q, { season })) ?? [];
  }, [client]);

  // Friday-bank: BUDGET+STANDARD+PREMIUM (kun brukt på fredag)
  const fetchMealBankFriday = useCallback(async () => {
    const season = currentSeason();
    const q = `*[_type=="mealIdea"
      && isActive == true
      && costTier in ["BUDGET","STANDARD","PREMIUM"]
      && (nutritionScore >= 7 || !defined(nutritionScore))
      && (!defined(season) || $season in season)
    ]{
      _id, title, tags, costTier, nutritionScore, allergens, season
    }`;
    return (await client.fetch<Meal[]>(q, { season })) ?? [];
  }, [client]);

  const fetchCooldownTitles = useCallback(
    async (mondayISO: string, weeksBack: number) => {
      const from = addDaysISO(mondayISO, -7 * weeksBack);
      const to = addDaysISO(mondayISO, -3);
      const q = `*[_type=="menuContent" && date >= $from && date <= $to]{ description }`;
      const rows = await client.fetch<Array<{ description?: string }>>(q, { from, to });
      const titles = rows?.map((r) => (r.description ?? "").trim()).filter(Boolean) ?? [];
      return new Set(titles);
    },
    [client]
  );

  const refreshStats = useCallback(async () => {
    try {
      const base = await fetchMealBankBase();
      const fri = await fetchMealBankFriday();

      const fish = base.filter((m) => hasTag(m, "fish")).length;
      const soup = base.filter((m) => hasTag(m, "soup")).length;
      const veg = base.filter((m) => hasTag(m, "veg")).length;
      const restBase = base.filter((m) => !hasTag(m, "fish") && !hasTag(m, "soup") && !hasTag(m, "veg")).length;

      const fridayPremium = fri.filter((m) => m.costTier === "PREMIUM").length;

      setBankStats({
        totalBase: base.length,
        fish,
        soup,
        veg,
        restBase,
        fridayTotal: fri.length,
        fridayPremium,
      });
    } catch {
      // ignore
    }
  }, [fetchMealBankBase, fetchMealBankFriday]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const validateWeekBeforePublish = useCallback(
    async (dates: string[]) => {
      const weekDocs = dates.map((d) => docs[d]).filter(Boolean) as MenuDoc[];
      if (weekDocs.length !== 5) throw new Error("Uken mangler dager (må ha 5 hverdager).");

      const titles = weekDocs.map((d) => (d.description ?? "").trim());
      if (titles.some((t) => !t || t.length < 8)) throw new Error("Alle dager må ha meny (min 8 tegn).");
      if (new Set(titles).size !== 5) throw new Error("Duplikate retter i samme uke.");

      const base = await fetchMealBankBase();
      const byTitle = new Map(base.map((m) => [m.title, m]));
      const tagsFor = (title: string) => byTitle.get(title)?.tags ?? null;

      const hasFish = titles.some((t) => tagsFor(t)?.includes("fish")) || titles.some((t) => /fisk|laks|torsk|sei|ørret|skrei|hyse|kveite/i.test(t));
      const hasSoup = titles.some((t) => tagsFor(t)?.includes("soup")) || titles.some((t) => /suppe/i.test(t));
      const hasVeg = titles.some((t) => tagsFor(t)?.includes("veg")) || titles.some((t) => /vegetar|linse|kikert|bønne|tofu/i.test(t));

      if (!hasFish) throw new Error("Uken mangler fisk.");
      if (!hasSoup) throw new Error("Uken mangler suppe.");
      if (!hasVeg) throw new Error("Uken mangler vegetar.");

      return true;
    },
    [docs, fetchMealBankBase]
  );

  const publishWeek = useCallback(
    async (dates: string[]) => {
      setBusy(true);
      setMsg(null);

      try {
        await ensureDates(dates);
        await fetchDocs();

        await validateWeekBeforePublish(dates);

        for (const dateISO of dates) {
          const _id = docIdForDate(dateISO);
          await client.patch(_id).set({ isPublished: true }).commit({ autoGenerateArrayKeys: true });
        }

        setMsg("✅ Uke publisert – bestilling aktivert for alle 5 dager.");
        await fetchDocs();
      } catch (e: any) {
        setMsg(`❌ Publisering stoppet: ${e?.message || String(e)}`);
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [client, ensureDates, fetchDocs, validateWeekBeforePublish]
  );

  const autofillWeek = useCallback(
    async (dates: string[], force = false, label = "uke") => {
      setBusy(true);
      setMsg(null);

      try {
        if (isWeekPublished(dates)) {
          throw new Error(`${label} er allerede publisert (helt eller delvis). Auto-fyll er sperret.`);
        }

        if (label === "uke 3" && !canGenerateWeek3Now) {
          throw new Error("Uke 3 kan ikke genereres før torsdag kl 08:00 i uke 1 (pipeline-lås).");
        }

        await ensureDates(dates);

        const base = await fetchMealBankBase();
        const fri = await fetchMealBankFriday();

        if (base.length < 50) throw new Error("Base-bank for liten etter filter (minst 50).");
        if (fri.length < 50) throw new Error("Fredags-bank for liten etter filter (minst 50).");

        const mondayISO = dates[0];
        const avoid = await fetchCooldownTitles(mondayISO, 4);

        const picked = buildWeekPlan5WithFriday(base, fri, avoid);

        for (let i = 0; i < dates.length; i++) {
          const dateISO = dates[i];
          const existing = docs[dateISO];
          const hasText = !!existing?.description?.trim();
          if (hasText && !force) continue;

          const meal = picked[i];
          const _id = docIdForDate(dateISO);

          await client
            .patch(_id)
            .set({
              description: meal.title,
              allergens: Array.isArray(meal.allergens) ? meal.allergens : [],
              isPublished: false,
            })
            .commit({ autoGenerateArrayKeys: true });
        }

        setMsg(
          `✅ Auto-fyll fullført (${label}): 1 suppe + 1 fisk + 1 vegetar + 1 suppler + Fredagsløft • cooldown 4 uker • sesongfilter.`
        );
        await fetchDocs();
        await refreshStats();
      } catch (e: any) {
        setMsg(`❌ Auto-fyll stoppet: ${e?.message || String(e)}`);
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [
      client,
      docs,
      ensureDates,
      fetchDocs,
      fetchMealBankBase,
      fetchMealBankFriday,
      fetchCooldownTitles,
      refreshStats,
      isWeekPublished,
      canGenerateWeek3Now,
    ]
  );

  const renderWeek = (title: string, dates: string[], lockedBanner?: React.ReactNode) => (
    <Card padding={4} radius={3} border>
      <Stack space={3}>
        <Flex align="center" justify="space-between">
          <Text weight="semibold" size={2}>
            {title}
          </Text>
          <Badge tone="default">
            {formatNordicDate(dates[0])} → {formatNordicDate(dates[4])}
          </Badge>
        </Flex>

        {lockedBanner}

        <Grid columns={1} gap={2}>
          {dates.map((d) => {
            const doc = docs[d];
            const exists = !!doc?._id;

            return (
              <Card key={d} padding={3} radius={2} border>
                <Flex align="center" justify="space-between" gap={3}>
                  <Stack space={2}>
                    <Text size={1} weight="semibold">
                      {labelForISO(d)}
                    </Text>

                    {exists ? (
                      <Text size={1} muted>
                        {doc?.description?.trim() ? doc.description : "— (ingen beskrivelse enda)"}
                      </Text>
                    ) : (
                      <Text size={1} muted>
                        Ikke opprettet ennå
                      </Text>
                    )}

                    <Flex gap={2} wrap="wrap">
                      <Badge tone={exists ? "positive" : "caution"}>{exists ? "Klar" : "Mangler"}</Badge>
                      <Badge tone={doc?.isPublished ? "positive" : "default"}>
                        {doc?.isPublished ? "Publisert" : "Ikke publisert"}
                      </Badge>
                    </Flex>
                  </Stack>

                  {exists ? (
                    <IntentLink intent="edit" params={{ id: doc!._id, type: "menuContent" }}>
                      <Button text="Rediger" mode="ghost" />
                    </IntentLink>
                  ) : null}
                </Flex>
              </Card>
            );
          })}
        </Grid>
      </Stack>
    </Card>
  );

  return (
    <Stack space={4} padding={4}>
      <Card padding={4} radius={3} border>
        <Flex align="center" justify="space-between" gap={3}>
          <Stack space={2}>
            <Text size={3} weight="bold">
              Ukeplan (2-ukers pipeline)
            </Text>
            <Text size={1} muted>
              Uke 2 blir synlig automatisk {formatNordicDate(addDaysISO(mondayA, 3))} kl 08:00 (Europe/Oslo).
            </Text>

            {bankStats ? (
              <Flex gap={2} wrap="wrap">
                <Badge tone="default">Base: {bankStats.totalBase}</Badge>
                <Badge tone="default">Fisk: {bankStats.fish}</Badge>
                <Badge tone="default">Suppe: {bankStats.soup}</Badge>
                <Badge tone="default">Veg: {bankStats.veg}</Badge>
                <Badge tone="default">Suppler: {bankStats.restBase}</Badge>
                <Badge tone="default">Fredag: {bankStats.fridayTotal}</Badge>
                <Badge tone="default">Premium-fredag: {bankStats.fridayPremium}</Badge>
                <Badge tone="default">Sesong: {currentSeason()}</Badge>
              </Flex>
            ) : null}
          </Stack>

          <Flex gap={2} wrap="wrap">
            <Button
              text="Opprett 2 uker"
              tone="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  await ensureDates([...weekA, ...weekB]);
                  setMsg("✅ Opprettet uke 1 + uke 2.");
                  await fetchDocs();
                  await refreshStats();
                } finally {
                  setBusy(false);
                }
              }}
            />

            <Button
              text="Opprett neste uke"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  await ensureDates([...weekC]);
                  setMsg("✅ Opprettet uke 3.");
                  await fetchDocs();
                  await refreshStats();
                } finally {
                  setBusy(false);
                }
              }}
            />

            <Button text="Auto-fyll uke 1" disabled={busy} onClick={() => autofillWeek(weekA, false, "uke 1")} />
            <Button text="Auto-fyll uke 2" disabled={busy} onClick={() => autofillWeek(weekB, false, "uke 2")} />
            <Button text="Auto-fyll uke 3" disabled={busy} onClick={() => autofillWeek(weekC, false, "uke 3")} />

            <Button text="Force auto-fyll uke 1" tone="caution" disabled={busy} onClick={() => autofillWeek(weekA, true, "uke 1")} />

            <Button text="Publiser uke 1" tone="positive" disabled={busy} onClick={() => publishWeek(weekA)} />
            <Button text="Publiser uke 2" tone="positive" disabled={busy} onClick={() => publishWeek(weekB)} />
            <Button text="Publiser uke 3" tone="positive" disabled={busy} onClick={() => publishWeek(weekC)} />

            <Button
              text="Oppdater"
              mode="ghost"
              disabled={busy}
              onClick={() => {
                fetchDocs();
                refreshStats();
              }}
            />
          </Flex>
        </Flex>

        {msg ? (
          <Card padding={3} radius={2} tone="transparent" marginTop={4} border>
            <Text size={1}>{msg}</Text>
          </Card>
        ) : null}
      </Card>

      {loading ? (
        <Card padding={4} radius={3} border>
          <Flex align="center" gap={3}>
            <Spinner />
            <Text size={1} muted>
              Henter ukeplan…
            </Text>
          </Flex>
        </Card>
      ) : (
        <Stack space={4}>
          {renderWeek("Denne uken (Uke 1)", weekA)}

          {renderWeek(
            "Neste uke (Uke 2)",
            weekB,
            !unlocked ? (
              <Card padding={3} radius={2} border tone="caution">
                <Text size={1}>
                  🔒 Uke 2 er låst for ansatte frem til <b>{formatNordicDateTime(unlockAt)}</b> (torsdag uke 1 kl 08:00).
                </Text>
              </Card>
            ) : (
              <Card padding={3} radius={2} border tone="positive">
                <Text size={1}>✅ Uke 2 er nå synlig for ansatte.</Text>
              </Card>
            )
          )}

          {!canGenerateWeek3Now ? (
            <Card padding={3} radius={2} border tone="caution">
              <Text size={1}>🔒 Uke 3 kan ikke auto-fylles før torsdag kl 08:00 i uke 1 (pipeline-lås).</Text>
            </Card>
          ) : null}

          {renderWeek("Uke etter (Uke 3 – klargjøring)", weekC)}
        </Stack>
      )}
    </Stack>
  );
}
