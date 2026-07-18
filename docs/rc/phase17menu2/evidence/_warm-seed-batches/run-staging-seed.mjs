/**
 * STAGING ONLY — Phase17MENU2 warm-bank mealIdea seed.
 * Creates drafts in batches of ≤10, publishes in chunks of ≤20.
 * NEVER targets production.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

const PROJECT = "4udoq5d8";
const DATASET = "staging";
if (DATASET === "production") throw new Error("REFUSE production");

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = {
  ...loadEnv("C:/prosjekter/lunchportalen/.env.local"),
  ...loadEnv("C:/prosjekter/lunchportalen/.env.preview.verify"),
};
const token = env.SANITY_WRITE_TOKEN || env.SANITY_API_TOKEN;
if (!token) throw new Error("no write token");

const client = createClient({
  projectId: PROJECT,
  dataset: DATASET,
  apiVersion: "2024-01-01",
  token,
  useCdn: false,
});

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];
const bankDir =
  "C:/prosjekter/lunchportalen-16no/docs/rc/phase17menu1/evidence/warm-banks";

const docs = [];
for (const cc of COUNTRIES) {
  const bank = JSON.parse(
    fs.readFileSync(path.join(bankDir, `${cc}.json`), "utf8"),
  );
  for (const d of bank.dishes) {
    const nn = d.dish_key.replace(/^[a-z]+-warm-/, "");
    const id = `mealIdea-${d.dish_key}`;
    docs.push({
      _id: id,
      _type: "mealIdea",
      countryCode: cc,
      menuProfileId: `market_${cc.toLowerCase()}`,
      dishKey: { _type: "slug", current: d.dish_key },
      title: `${cc} warm dish ${nn}`,
      category: "varmrett",
      description: `Phase17MENU2 staging seed. recipe_version=${d.recipe_version}; portion_g=${d.portion_weight_g}; contribution_bps=${d.contribution_bps}. NOT generation-eligible until full production-ready recipe fields are completed.`,
      allergens: [],
      isActive: true,
      tags: ["other"],
      kitchenStyle: "international",
      estimatedCostPerPortion: 45,
      costTier: "STANDARD",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      productionComplexity: "MEDIUM",
      nutritionScore: 7,
    });
  }
}

const publishedExisting = await client.fetch(
  `*[_type=="mealIdea" && defined(countryCode) && !(_id in path("drafts.**"))][]._id`,
);
const existing = new Set(publishedExisting);

const todo = docs.filter((d) => !existing.has(d._id));
console.log(
  JSON.stringify({
    project: PROJECT,
    dataset: DATASET,
    total: docs.length,
    alreadyPublished: existing.size,
    todo: todo.length,
  }),
);

let created = 0;
for (let i = 0; i < todo.length; i += 10) {
  const chunk = todo.slice(i, i + 10);
  const tx = client.transaction();
  for (const d of chunk) {
    const { _id, ...rest } = d;
    tx.createIfNotExists({ ...rest, _id: `drafts.${_id}` });
  }
  await tx.commit({ visibility: "async" });
  created += chunk.length;
  if (created % 100 === 0 || created === todo.length) {
    console.log(`created_drafts ${created}/${todo.length}`);
  }
}

const allTargetIds = docs.map((d) => d._id);
const draftIdsPresent = await client.fetch(
  `*[_type=="mealIdea" && _id in path("drafts.**") && defined(countryCode)]._id`,
);
const publishList = draftIdsPresent
  .map((id) => id.replace(/^drafts\./, ""))
  .filter((id) => allTargetIds.includes(id));

let published = 0;
for (let i = 0; i < publishList.length; i += 20) {
  const chunk = publishList.slice(i, i + 20);
  await client.action(
    chunk.map((id) => ({
      actionType: "sanity.action.document.publish",
      publishedId: id,
      draftId: `drafts.${id}`,
    })),
  );
  published += chunk.length;
  if (published % 100 === 0 || published === publishList.length) {
    console.log(`published ${published}/${publishList.length}`);
  }
}

const mealIdeaCount = await client.fetch(
  `count(*[_type=="mealIdea" && defined(countryCode) && !(_id in path("drafts.**"))])`,
);
const countryCount = await client.fetch(
  `count(array::unique(*[_type=="mealIdea" && defined(countryCode) && !(_id in path("drafts.**"))].countryCode))`,
);

const out = {
  projectId: PROJECT,
  dataset: DATASET,
  seededAt: new Date().toISOString(),
  source: "docs/rc/phase17menu1/evidence/warm-banks",
  expectedDocs: docs.length,
  createdDrafts: created,
  published,
  mealIdeaWithCountryCode: mealIdeaCount,
  uniqueCountryCodes: countryCount,
};

const outPath =
  "C:/prosjekter/lunchportalen-16no/docs/rc/phase17menu2/evidence/warm-seed-status.json";
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log("RESULT", JSON.stringify(out));
