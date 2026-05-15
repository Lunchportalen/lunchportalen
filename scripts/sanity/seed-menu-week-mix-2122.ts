/**
 * Sanity — idempotent MIX-tier menuDay-seed for uke 21–22 (2026).
 * Oppretter 42 dokumenter: per dag ett plan‑tier (Melhus MIX) × categories for det planet.
 *
 * Requires: write-token (SANITY_WRITE_TOKEN, SANITY_TOKEN, eller SANITY_API_TOKEN) til dataset «production»
 * Usage:
 *   npx tsx scripts/sanity/seed-menu-week-mix-2122.ts --dry-run
 *   npx tsx scripts/sanity/seed-menu-week-mix-2122.ts
 */
import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";
import { pathToFileURL } from "node:url";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";

type PlanTier = "BASIS" | "LUXUS";
type Category = "paasmurt" | "salat" | "sushi" | "pokebowl" | "thai" | "varmrett";

const PLAN_CATEGORIES: Record<PlanTier, Category[]> = {
  BASIS: ["paasmurt", "salat", "varmrett"],
  LUXUS: ["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"],
};

const MIX_TIER_BY_DATE: Record<string, PlanTier> = {
  "2026-05-18": "BASIS",
  "2026-05-19": "BASIS",
  "2026-05-20": "LUXUS",
  "2026-05-21": "BASIS",
  "2026-05-22": "LUXUS",
  "2026-05-25": "BASIS",
  "2026-05-26": "BASIS",
  "2026-05-27": "LUXUS",
  "2026-05-28": "BASIS",
  "2026-05-29": "LUXUS",
};

function safeEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function isISODate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdaysMonFri(mondayISO: string): string[] {
  return [0, 1, 2, 3, 4].map((offset) => addDaysISO(mondayISO, offset));
}

function weekdayUTC(dateISO: string): number {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

function isMondayISO(dateISO: string): boolean {
  return isISODate(dateISO) && weekdayUTC(dateISO) === 1;
}


type MenuDaySeedDoc = { _id: string; _type: "menuDay" } & Record<string, unknown>;

type MenuItemBlock = Record<string, unknown>;

function mkItem(slugCurrent: string, title: string, allergens: string[], isVegetarian: boolean): MenuItemBlock {
  return {
    _type: "menuItem",
    _key: slugCurrent.replace(/-/g, "_"),
    key: { _type: "slug", current: slugCurrent },
    title,
    allergens,
    isVegetarian,
    available: true,
  };
}

function costTierForPlan(planTier: PlanTier): "BUDGET" | "STANDARD" {
  return planTier === "LUXUS" ? "STANDARD" : "BUDGET";
}

function estimatedCostForPlan(planTier: PlanTier): number {
  return planTier === "LUXUS" ? 55 : 27;
}

function pickVarmrettTitle(date: string): string {
  let sum = 0;
  for (let i = 0; i < date.length; i++) sum += date.charCodeAt(i);
  return sum % 2 === 0 ? "Kjøttkaker i brun saus" : "Lasagne";
}

function varmrettAllergensForTitle(title: string): string[] {
  return title.toLowerCase().includes("lasagne")
    ? ["hvete", "melk", "selleri"]
    : ["hvete", "egg", "melk", "selleri"];
}

function buildMenuDocuments(nowISO: string): MenuDaySeedDoc[] {
  const mondays = ["2026-05-18", "2026-05-25"];
  for (const m of mondays) {
    if (!isMondayISO(m)) throw new Error(`Forventet mandag YYYY-MM-DD, fikk ${m}`);
  }
  const docs: MenuDaySeedDoc[] = [];

  for (const mon of mondays) {
    const dates = weekdaysMonFri(mon);
    for (const date of dates) {
      const tier = MIX_TIER_BY_DATE[date];
      if (!tier) {
        console.warn(`SKIP uventet dato uten MIX-tier: ${date}`);
        continue;
      }
      for (const category of PLAN_CATEGORIES[tier]) {
        const _id = `menuDay-${date}-${tier}-${category}`;
        const base: MenuDaySeedDoc = {
          _id,
          _type: "menuDay",
          date,
          planTier: tier,
          category,
          approvedForPublish: true,
          approvedAt: nowISO,
          customerVisible: true,
          customerVisibleSetAt: nowISO,
          isFishDish: false,
          isSoup: false,
          costTier: costTierForPlan(tier),
          estimatedCostPerPortion: estimatedCostForPlan(tier),
        };

        switch (category) {
          case "paasmurt": {
            Object.assign(base, {
              mealTitle: "Påsmurt — velg variant",
              description: "Dagens påsmurt: velg kjøtt, skinke eller vegetar.",
              allergens: [],
              kitchenStyle: "norwegian",
              items: [
                mkItem("kylling", "Kylling og majo på grovbrød", ["hvete", "selleri", "egg", "sennep"], false),
                mkItem("skinke", "Skinke og ost", ["hvete", "melk", "selleri", "sennep"], false),
                mkItem("vegetar", "Ost og grønt", ["hvete", "melk", "selleri"], true),
              ],
            });
            break;
          }
          case "salat": {
            Object.assign(base, {
              mealTitle: "Salatboks — velg dressing og protein",
              description: "Sprø salat som basis.",
              allergens: [],
              kitchenStyle: "norwegian",
              items: [
                mkItem("kylling", "Salat med kylling", ["selleri"], false),
                mkItem("skinke", "Salat med skinke", ["selleri"], false),
                mkItem("vegetar", "Vegetarsalat", ["selleri"], true),
              ],
            });
            break;
          }
          case "sushi": {
            Object.assign(base, {
              mealTitle: "Sushi — velg set",
              description: "Dagens sushi med to tydelige valg.",
              allergens: [],
              kitchenStyle: "asian",
              isFishDish: true,
              items: [
                mkItem("laks", "Laks og ris", ["fisk", "soya", "sesam"], false),
                mkItem(
                  "vegetar",
                  "Avokado og grønnsaksmaki",
                  ["hvete", "selleri"],
                  true,
                ),
              ],
            });
            break;
          }
          case "pokebowl": {
            Object.assign(base, {
              mealTitle: "Pokébowl — velg protein",
              description: "Ris‑bowl med grønt og dressing.",
              allergens: [],
              kitchenStyle: "asian",
              items: [
                mkItem("laks", "Bowle med laks", ["fisk", "sesam"], false),
                mkItem("kylling", "Bowle med kylling", ["soya"], false),
                mkItem("vegetar", "Bowle med tofu", ["soya", "sesam"], true),
              ],
            });
            break;
          }
          case "thai": {
            Object.assign(base, {
              mealTitle: "Thaimat — velg klassiker",
              description: "Kokt på kjøkknet — velg rett.",
              allergens: [],
              kitchenStyle: "asian",
              items: [
                mkItem("pad-thai", "Pad Thai", ["soya", "egg", "sesam"], false),
                mkItem("biff-peppersaus", "Biff i peppersaus", ["soya", "sesam", "selleri"], false),
              ],
            });
            break;
          }
          case "varmrett": {
            const title = pickVarmrettTitle(date);
            const allergensTop = varmrettAllergensForTitle(title);
            Object.assign(base, {
              mealTitle: title,
              description:
                title.toLowerCase().includes("kjøttkaker")
                  ? "Serveres med kokte poteter og saus."
                  : "Lagvis pasta med kjøttsaus og ost.",
              allergens: allergensTop,
              kitchenStyle: "norwegian",
              items: [],
            });
            break;
          }
          default:
            continue;
        }

        docs.push(base);
      }
    }
  }
  return docs;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const nowISO = new Date().toISOString();
  const docs = buildMenuDocuments(nowISO);

  if (docs.length !== 42) {
    console.error(`FAIL: forventet 42 dokumenter, fikk ${docs.length}`);
    process.exit(1);
  }

  const w21Dates = weekdaysMonFri("2026-05-18");
  const w22Dates = weekdaysMonFri("2026-05-25");
  const nW1 = docs.filter((d) => w21Dates.includes(String(d.date))).length;
  const nW2 = docs.filter((d) => w22Dates.includes(String(d.date))).length;
  if (nW1 !== 21 || nW2 !== 21) {
    console.error(`FAIL: forventet 21 dokumenter pr uke, fikk uke21=${nW1} uke22=${nW2}`);
    process.exit(1);
  }

  const projectId = safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") || safeEnv("SANITY_PROJECT_ID") || "4udoq5d8";
  const dataset = safeEnv("NEXT_PUBLIC_SANITY_DATASET") || safeEnv("SANITY_DATASET") || "production";

  if (dryRun) {
    console.log(`[DRY-RUN] Sanity ${projectId}/${dataset} — mutations: ${docs.length}`);
    for (const d of docs.slice(0, 4)) console.log(JSON.stringify({ _id: d._id, date: d.date, planTier: d.planTier, category: d.category }));
    console.log(`… (+${docs.length - 4} flere)`);
    return;
  }

  const token =
    process.env.SANITY_WRITE_TOKEN ??
    process.env.SANITY_TOKEN ??
    process.env.SANITY_API_TOKEN;

  if (!token || !token.trim()) {
    throw new Error("Sanity write token missing. Set SANITY_WRITE_TOKEN, SANITY_TOKEN, or SANITY_API_TOKEN.");
  }

  const writeToken = token.trim();

  console.log(`Sanity ${projectId}/${dataset} — mutations: ${docs.length}`);
  const client = createClient({ projectId, dataset, apiVersion: API_VERSION, token: writeToken, useCdn: false });

  for (const doc of docs) {
    await client.createOrReplace(doc);
  }

  console.log(`OK createOrReplace for ${docs.length} menuDay-dokumenter.`);

  const ids = docs.map((d) => String(d._id));
  const idCount = await client.fetch<number>(`count(*[_type == "menuDay" && _id in $ids])`, {
    ids,
  });
  console.log(`Verify id‑subset (42 forventede _id-er): ${idCount}/${ids.length}`);

  for (const mon of ["2026-05-18", "2026-05-25"]) {
    const weekDates = weekdaysMonFri(mon);
    const wc = docs.filter((d) => weekDates.includes(String(d.date))).length;
    console.log(`Lokal dokumenttelling (${mon}-uke): ${wc}`);
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isDirectRun()) {
  main().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });
}
