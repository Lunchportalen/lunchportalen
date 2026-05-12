import { createClient } from "@sanity/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PLAN_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const CATEGORIES = ["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PLAN_CATEGORIES: Record<PlanTier, Category[]> = {
  BASIS: ["paasmurt", "salat", "varmrett"],
  LUXUS: ["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"],
  ENTERPRISE: ["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"],
};

export type MealIdea = {
  _id: string;
  title: string;
  description?: string | null;
  allergens?: string[] | null;
  mayContain?: string[] | null;
  nutritionPer100g?: Record<string, unknown> | null;
  kitchenStyle?: string | null;
  isFishDish?: boolean | null;
  isSoup?: boolean | null;
  isVegetarian?: boolean | null;
};

export type MenuDaySeedDoc = {
  _id: string;
  _type: "menuDay";
  date: string;
  planTier: PlanTier;
  category: Category;
  mealRef: { _type: "reference"; _ref: string };
  mealTitle: string;
  description: string;
  allergens: string[];
  mayContain: string[];
  nutritionPer100g?: Record<string, unknown> | null;
  kitchenStyle?: string | null;
  costTier: "BUDGET" | "STANDARD" | "PREMIUM";
  estimatedCostPerPortion: number;
  approvedForPublish: true;
  approvedAt: string;
  customerVisible: true;
  customerVisibleSetAt: string;
  isFishDish: boolean;
  isSoup: boolean;
  isVegetarian: boolean;
};

type SeedArgs = {
  weekStart?: string;
  dryRun: boolean;
  force: boolean;
};

const API_VERSION = "2024-01-01";
const LOG_PATH = path.join("docs", "audit", "sanity-seed-log.md");

function safeEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function parseArgs(argv: string[]): SeedArgs {
  const out: SeedArgs = { dryRun: argv.includes("--dry-run"), force: argv.includes("--force") };
  const idx = argv.indexOf("--week-start");
  if (idx >= 0) out.weekStart = String(argv[idx + 1] ?? "").trim();
  return out;
}

function isISODate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayUTC(dateISO: string): number {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

export function isMondayISO(dateISO: string): boolean {
  return isISODate(dateISO) && weekdayUTC(dateISO) === 1;
}

export function nextMondayFrom(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
  const day = d.getUTCDay();
  const daysUntilNextMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilNextMonday);
  return d.toISOString().slice(0, 10);
}

export function weekdaysForWeekStart(weekStart: string): string[] {
  if (!isMondayISO(weekStart)) {
    throw new Error(`Ugyldig week-start: ${weekStart}. Datoen må være en mandag (YYYY-MM-DD).`);
  }
  return [0, 1, 2, 3, 4].map((offset) => addDaysISO(weekStart, offset));
}

export function pickMealIdeaForCategory(
  meals: MealIdea[],
  category: Category,
  planTier: PlanTier,
  dayIndex: number,
): MealIdea {
  if (!meals.length) throw new Error("Ingen mealIdea-dokumenter tilgjengelig.");
  const seed = `${category}-${planTier}-${dayIndex}`;
  const hash = seed.split("").reduce((h, c) => h + c.charCodeAt(0), 0);
  return meals[hash % meals.length];
}

function costTierForPlan(planTier: PlanTier): MenuDaySeedDoc["costTier"] {
  if (planTier === "ENTERPRISE") return "PREMIUM";
  if (planTier === "LUXUS") return "STANDARD";
  return "BUDGET";
}

function estimatedCostForPlan(planTier: PlanTier): number {
  if (planTier === "ENTERPRISE") return 75;
  if (planTier === "LUXUS") return 55;
  return 27;
}

function arrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.map((x) => String(x)).filter(Boolean) : [];
}

export function buildMenuDaySeedDocs(weekStart: string, meals: MealIdea[], nowISO = new Date().toISOString()): MenuDaySeedDoc[] {
  const dates = weekdaysForWeekStart(weekStart);
  const docs: MenuDaySeedDoc[] = [];

  dates.forEach((date, dayIndex) => {
    for (const planTier of PLAN_TIERS) {
      for (const category of PLAN_CATEGORIES[planTier]) {
        const mealIdea = pickMealIdeaForCategory(meals, category, planTier, dayIndex);
        docs.push({
          _id: `menuDay-${date}-${planTier}-${category}`,
          _type: "menuDay",
          date,
          planTier,
          category,
          mealRef: { _type: "reference", _ref: mealIdea._id },
          mealTitle: mealIdea.title,
          description: mealIdea.description ?? "Ingen beskrivelse",
          allergens: arrayOrEmpty(mealIdea.allergens),
          mayContain: arrayOrEmpty(mealIdea.mayContain),
          nutritionPer100g: mealIdea.nutritionPer100g,
          kitchenStyle: mealIdea.kitchenStyle,
          costTier: costTierForPlan(planTier),
          estimatedCostPerPortion: estimatedCostForPlan(planTier),
          approvedForPublish: true,
          approvedAt: nowISO,
          customerVisible: true,
          customerVisibleSetAt: nowISO,
          isFishDish: mealIdea.isFishDish ?? false,
          isSoup: mealIdea.isSoup ?? false,
          isVegetarian: mealIdea.isVegetarian ?? false,
        });
      }
    }
  });

  return docs;
}

function summarizeByTier(docs: Array<{ planTier: PlanTier }>): Record<PlanTier, number> {
  return docs.reduce(
    (acc, doc) => {
      acc[doc.planTier] += 1;
      return acc;
    },
    { BASIS: 0, LUXUS: 0, ENTERPRISE: 0 } satisfies Record<PlanTier, number>,
  );
}

function writeAuditLog(args: {
  weekStart: string;
  dryRun: boolean;
  force: boolean;
  created: number;
  skipped: number;
  replaced: number;
  createdByTier: Record<PlanTier, number>;
  skippedByTier: Record<PlanTier, number>;
  replacedByTier: Record<PlanTier, number>;
  docs: MenuDaySeedDoc[];
}) {
  mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  const timestamp = new Date().toISOString();
  const operator = process.env.USER ?? userInfo().username ?? "unknown";
  const lines = [
    "# Sanity seed — menuDay uke",
    "",
    `**Tidspunkt:** ${timestamp}`,
    `**Operator:** ${operator}`,
    `**Week start:** ${args.weekStart}`,
    `**Dry-run:** ${args.dryRun ? "ja" : "nei"}`,
    `**Force:** ${args.force ? "ja" : "nei"}`,
    `**Opprettet:** ${args.created}`,
    `**Hoppet over:** ${args.skipped}`,
    `**Erstattet:** ${args.replaced}`,
    "",
    "## Per plan",
    "",
    `- BASIS: created ${args.createdByTier.BASIS}, skipped ${args.skippedByTier.BASIS}, replaced ${args.replacedByTier.BASIS}`,
    `- LUXUS: created ${args.createdByTier.LUXUS}, skipped ${args.skippedByTier.LUXUS}, replaced ${args.replacedByTier.LUXUS}`,
    `- ENTERPRISE: created ${args.createdByTier.ENTERPRISE}, skipped ${args.skippedByTier.ENTERPRISE}, replaced ${args.replacedByTier.ENTERPRISE}`,
    "",
    "## Dokumenter",
    "",
    ...args.docs.map((doc) => `- ${doc._id}`),
    "",
  ];
  writeFileSync(LOG_PATH, lines.join("\n"), { encoding: "utf-8" });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = safeEnv("SANITY_TOKEN");
  if (!token) {
    console.error("FAIL: SANITY_TOKEN mangler i env.");
    console.error('Kjør: $env:SANITY_TOKEN="<token>"; npm run sanity:seed-menu-week -- --week-start 2026-06-01 --dry-run');
    process.exit(1);
  }

  const weekStart = args.weekStart || nextMondayFrom();
  const dates = weekdaysForWeekStart(weekStart);
  const projectId = safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") || safeEnv("SANITY_PROJECT_ID") || "4udoq5d8";
  const dataset = safeEnv("NEXT_PUBLIC_SANITY_DATASET") || safeEnv("SANITY_DATASET") || "production";
  const client = createClient({ projectId, dataset, apiVersion: API_VERSION, token, useCdn: false });

  const meals = await client.fetch<MealIdea[]>(
    `*[_type == "mealIdea" && !(_id in path("drafts.**"))] | order(_id asc) {
      _id,
      title,
      description,
      allergens,
      mayContain,
      nutritionPer100g,
      kitchenStyle,
      isFishDish,
      isSoup,
      isVegetarian
    }`,
  );

  if (meals.length < 30) {
    console.error(`FAIL: mealIdea-poolen har ${meals.length} dokumenter. Minst 30 kreves.`);
    process.exit(1);
  }

  const nowISO = new Date().toISOString();
  const docs = buildMenuDaySeedDocs(weekStart, meals, nowISO);
  const ids = docs.map((doc) => doc._id);
  const existingIds = new Set(await client.fetch<string[]>(`*[_type == "menuDay" && _id in $ids]._id`, { ids }));
  const existingLegacyIds = new Set(await client.fetch<string[]>(`*[_type == "menuDay" && _id in $ids]._id`, { ids: dates.map((date) => `menuDay-${date}`) }));

  console.log(`Sanity dataset: ${projectId}/${dataset}`);
  console.log(`Week start: ${weekStart}`);
  console.log(`MealIdea-pool: ${meals.length}`);
  console.log(`Planlagte menuDay-dokumenter: ${docs.length}`);
  if (existingLegacyIds.size > 0) {
    console.log(`Eksisterende legacy menuDay-dokumenter berøres ikke: ${Array.from(existingLegacyIds).join(", ")}`);
  }

  const createdDocs: MenuDaySeedDoc[] = [];
  const skippedDocs: MenuDaySeedDoc[] = [];
  const replacedDocs: MenuDaySeedDoc[] = [];

  for (const doc of docs) {
    const exists = existingIds.has(doc._id);
    if (args.dryRun) {
      const action = exists && args.force ? "REPLACE" : exists ? "SKIP" : "CREATE";
      console.log(`${action} ${doc._id}`);
      if (exists && !args.force) skippedDocs.push(doc);
      else if (exists && args.force) replacedDocs.push(doc);
      else createdDocs.push(doc);
      continue;
    }

    if (args.force) {
      await client.createOrReplace(doc);
      if (exists) replacedDocs.push(doc);
      else createdDocs.push(doc);
    } else if (exists) {
      skippedDocs.push(doc);
    } else {
      await client.createIfNotExists(doc);
      createdDocs.push(doc);
    }
  }

  const createdByTier = summarizeByTier(createdDocs);
  const skippedByTier = summarizeByTier(skippedDocs);
  const replacedByTier = summarizeByTier(replacedDocs);

  console.log(
    `Created ${createdByTier.BASIS} BASIS docs, ${createdByTier.LUXUS} LUXUS docs, ${createdByTier.ENTERPRISE} ENTERPRISE docs`,
  );
  console.log(`Skipped ${skippedDocs.length} existing docs. Replaced ${replacedDocs.length} docs.`);

  writeAuditLog({
    weekStart,
    dryRun: args.dryRun,
    force: args.force,
    created: createdDocs.length,
    skipped: skippedDocs.length,
    replaced: replacedDocs.length,
    createdByTier,
    skippedByTier,
    replacedByTier,
    docs,
  });
  console.log(`Logg skrevet til ${LOG_PATH}`);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error("FAIL:", err);
    process.exit(1);
  });
}
