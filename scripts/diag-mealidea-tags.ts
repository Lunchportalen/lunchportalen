/**
 * READ-ONLY: tag-frekvens og co-forekomst i mealIdea (prod-bank).
 * Dag-1 generator-simulering bruker samme pool som cron (fetchMealIdeaBank + nutritionsfilter).
 *
 * npm run diag:mealidea-tags
 */
import { createClient, type SanityClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

import { addDaysISO } from "@/lib/date/oslo";
import {
  pickFirstWeekdayMealForDiagnostics,
  type Meal,
} from "@/lib/menu-publish/generateWeekMenu";
import {
  fetchMealIdeaBank,
  hasCompleteNutrition,
  normalizeMenuTitleKey,
} from "@/lib/menu-publish/mealIdeaBankQuery";
import { validateRolloutWeekMondayIso } from "@/lib/menu-publish/runMenuWeekRolloutCore";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";
const SAMPLE_MONDAY = "2026-06-08";

type TagRow = {
  _id: string;
  title?: string;
  tags?: string[];
  kitchenStyle?: string;
  method?: string;
  isFishDish?: boolean;
  isSoup?: boolean;
  isVegetarian?: boolean;
  isVeg?: boolean;
};

function requireEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Mangler env: ${name}`);
  return v;
}

function buildSanityRead(): SanityClient {
  const projectId = requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const dataset = requireEnv("NEXT_PUBLIC_SANITY_DATASET");
  const apiVersion =
    String(process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "").trim() || API_VERSION;
  const token = String(
    process.env.SANITY_READ_TOKEN ??
      process.env.SANITY_WRITE_TOKEN ??
      process.env.SANITY_TOKEN ??
      process.env.SANITY_API_TOKEN ??
      "",
  ).trim();
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: token || undefined,
  });
}

async function fetchCooldownTitleKeys(sanity: SanityClient, weekMondayISO: string): Promise<Set<string>> {
  const from = addDaysISO(weekMondayISO, -28);
  const to = addDaysISO(weekMondayISO, -1);

  const rows = await sanity.fetch<Array<{ mealTitle?: string | null; description?: string | null }>>(
    `*[
      _type == "menuDay" &&
      date >= $from &&
      date <= $to &&
      !(_id in path("drafts.**"))
    ] { mealTitle, description }`,
    { from, to },
  );

  const keys = new Set<string>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const k = normalizeMenuTitleKey(r.mealTitle || r.description || "");
    if (k) keys.add(k);
  }
  return keys;
}

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

function mealTagSet(meal: Meal): Set<string> {
  return new Set((Array.isArray(meal.tags) ? meal.tags : []).map((t) => String(t)));
}

function countOverlapTags(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) {
    if (b.has(t)) n += 1;
  }
  return n;
}

const GROQ_BANK = `*[_type == "mealIdea" && isActive == true] {
  _id,
  title,
  tags,
  kitchenStyle,
  method,
  isFishDish,
  isSoup,
  isVegetarian,
  "isVeg": "Vegetar/Vegan" in coalesce(tags, []) || "vegetar" in coalesce(tags, [])
}`;

async function mainAsync(): Promise<void> {
  const client = buildSanityRead();
  console.log("[diag-mealidea-tags] Leser aktiv mealIdea-bank (read-only)…\n");

  const rows = await client.fetch<TagRow[]>(GROQ_BANK);
  const docs = Array.isArray(rows) ? rows : [];
  const N = docs.length;

  // —— A) Topp 50 tag-frekvens ——
  const tagFreq = new Map<string, number>();
  const tagCountDist = new Map<number, number>();
  const pairFreq = new Map<string, number>();

  const suspiciousWhitespace: string[] = [];
  const byLower = new Map<string, Set<string>>();

  for (const doc of docs) {
    const rawTags = Array.isArray(doc.tags) ? doc.tags : [];
    const uniqueInDoc = new Set<string>();
    for (const t of rawTags) {
      const s = String(t);
      if (s !== s.trim()) suspiciousWhitespace.push(s);
      uniqueInDoc.add(s);

      const lk = normKey(s);
      if (!byLower.has(lk)) byLower.set(lk, new Set());
      byLower.get(lk)!.add(s);
    }

    for (const s of uniqueInDoc) {
      const lk = normKey(s);
      if (!byLower.has(lk)) byLower.set(lk, new Set());
      byLower.get(lk)!.add(s);
      tagFreq.set(s, (tagFreq.get(s) ?? 0) + 1);
    }

    const nTags = uniqueInDoc.size;
    const bucket = nTags >= 8 ? 8 : nTags;
    tagCountDist.set(bucket, (tagCountDist.get(bucket) ?? 0) + 1);

    const tagArr = [...uniqueInDoc].sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < tagArr.length; i += 1) {
      for (let j = i + 1; j < tagArr.length; j += 1) {
        const a = tagArr[i];
        const b = tagArr[j];
        const key = a < b ? `${a}\t${b}` : `${b}\t${a}`;
        pairFreq.set(key, (pairFreq.get(key) ?? 0) + 1);
      }
    }
  }

  const sortedTags = [...tagFreq.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

  console.log("=== A) Topp 50 tags (antall retter som inneholder tag; kan summe >N ved flere tags per rett) ===");
  console.log("tag | antall_retter | promille_av_korpus (‰) | pct_korpus (%)");
  for (const [tag, c] of sortedTags.slice(0, 50)) {
    const perMille = N > 0 ? (c / N) * 1000 : 0;
    const pct = N > 0 ? (c / N) * 100 : 0;
    console.log(
      `${tag.replace(/\|/g, "\\|")} | ${c} | ${perMille.toFixed(1)} | ${pct.toFixed(1)}`,
    );
  }

  console.log("\n=== B) Unike tags (eksakt streng) ===");
  console.log(String(tagFreq.size));

  console.log("\n=== C) Fordeling: antall unike tags per rett ===");
  console.log("(bucket 8 = 8 eller flere unike tags)");
  for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    const label = k === 8 ? "8+" : String(k);
    console.log(`${label} tags: ${tagCountDist.get(k) ?? 0} retter`);
  }

  console.log("\n=== D) Topp 20 tag-par (samme rett), sortert etter co-forekomst ===");
  const topPairs = [...pairFreq.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  for (const [key, c] of topPairs.slice(0, 20)) {
    const [t1, t2] = key.split("\t");
    console.log(`${c}\t${t1} + ${t2}`);
  }

  console.log("\n=== Mistenkelige tags ===");
  const caseDupClusters: string[] = [];
  for (const [lk, originals] of byLower) {
    if (originals.size > 1) {
      caseDupClusters.push(`${lk} → ${[...originals].join(" | ")}`);
    }
  }
  caseDupClusters.sort((a, b) => a.localeCompare(b));
  console.log(`Case-varianter (samme normKey): ${caseDupClusters.length} klynger`);
  for (const line of caseDupClusters.slice(0, 40)) {
    console.log(`  ${line}`);
  }
  if (caseDupClusters.length > 40) console.log(`  … +${caseDupClusters.length - 40} til`);

  const wsUnique = [...new Set(suspiciousWhitespace)];
  console.log(`\nLeading/trailing whitespace (unike): ${wsUnique.length}`);
  for (const s of wsUnique.slice(0, 25)) {
    console.log(`  JSON: ${JSON.stringify(s)}`);
  }
  if (wsUnique.length > 25) console.log(`  … +${wsUnique.length - 25} til`);

  // —— E) Dag 1 pick for 2026-06-08 ——
  console.log("\n=== E) Dag 1 pick (BASIS, samme pool som generateWeekMenu / cron) ===");
  const monday = validateRolloutWeekMondayIso(SAMPLE_MONDAY);
  const avoidTitles = await fetchCooldownTitleKeys(client, monday);
  const clock = new Date();
  const bankRaw = await fetchMealIdeaBank(client, "BASIS", false, clock);
  const baseMeals = bankRaw.filter(hasCompleteNutrition);
  console.log(`Korpus (A–D): ${N} aktive mealIdea`);
  console.log(`Generator-pool BASE (nutrition OK): ${baseMeals.length}`);
  console.log(`avoidTitles (cooldown ~4 uker): ${avoidTitles.size}`);
  console.log(
    "Første ukedags-rett: deterministisk sortering (score ↓, tie-break _id) — ikke stokastisk som prod sortCandidates.",
  );

  const first = pickFirstWeekdayMealForDiagnostics(baseMeals, avoidTitles, { deterministicSort: true });
  if (!first) {
    console.log("Ingen første rett funnet (pool for liten eller alle filtrert av avoidTitles?)");
    return;
  }

  const firstTags = [...mealTagSet(first)];
  const firstSet = new Set(firstTags);
  let share2 = 0;
  for (const m of baseMeals) {
    if (m._id === first._id) continue;
    if (countOverlapTags(firstSet, mealTagSet(m)) >= 2) share2 += 1;
  }

  const genericTags = new Set(["lunsj", "varmmat"]);
  const firstMeaningful = new Set(firstTags.filter((t) => !genericTags.has(t)));
  let share2Meaningful = 0;
  for (const m of baseMeals) {
    if (m._id === first._id) continue;
    if (countOverlapTags(firstMeaningful, mealTagSet(m)) >= 2) share2Meaningful += 1;
  }

  console.log(`_id: ${first._id}`);
  console.log(`title: ${first.title}`);
  console.log(`kitchenStyle: ${first.kitchenStyle ?? "(mangler)"}`);
  console.log(`method: ${first.method ?? "(mangler)"}`);
  console.log(`tags (${firstTags.length}): ${JSON.stringify(firstTags)}`);
  console.log(
    `Andre retter i generator-pool med ≥2 felles tags (alle 7 telt med): ${share2} av ${baseMeals.length - 1}`,
  );
  if (genericTags.size > 0) {
    console.log(
      `  → Ekskl. universelle tags [lunsj,varmmat]: ≥2 felles blant gjenværende ${firstMeaningful.size} tags: ${share2Meaningful} av ${baseMeals.length - 1}`,
    );
  }
}

void mainAsync().catch((e) => {
  console.error(e);
  process.exit(1);
});
