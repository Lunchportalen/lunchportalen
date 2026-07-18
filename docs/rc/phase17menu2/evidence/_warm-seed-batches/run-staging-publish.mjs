/**
 * STAGING ONLY — publish mealIdea warm-bank drafts in chunks ≤20.
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
const allTargetIds = [];
for (const cc of COUNTRIES) {
  const bank = JSON.parse(
    fs.readFileSync(path.join(bankDir, `${cc}.json`), "utf8"),
  );
  for (const d of bank.dishes) {
    allTargetIds.push(`mealIdea-${d.dish_key}`);
  }
}

const draftIdsPresent = await client.fetch(
  `*[_type=="mealIdea" && _id in path("drafts.**") && defined(countryCode)]._id`,
);
const publishList = draftIdsPresent
  .map((id) => id.replace(/^drafts\./, ""))
  .filter((id) => allTargetIds.includes(id));

console.log(
  JSON.stringify({
    project: PROJECT,
    dataset: DATASET,
    draftsToPublish: publishList.length,
  }),
);

let published = 0;
for (let i = 0; i < publishList.length; i += 20) {
  const chunk = publishList.slice(i, i + 20);
  const drafts = await client.fetch(`*[_id in $ids]`, {
    ids: chunk.map((id) => `drafts.${id}`),
  });
  const byId = new Map(drafts.map((d) => [d._id.replace(/^drafts\./, ""), d]));
  const tx = client.transaction();
  for (const id of chunk) {
    const draft = byId.get(id);
    if (!draft) continue;
    const { _id, _rev, _updatedAt, _createdAt, ...rest } = draft;
    tx.createOrReplace({ ...rest, _id: id });
    tx.delete(`drafts.${id}`);
  }
  await tx.commit({ visibility: "async" });
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
  expectedDocs: allTargetIds.length,
  published,
  mealIdeaWithCountryCode: mealIdeaCount,
  uniqueCountryCodes: countryCount,
};

const outPath =
  "C:/prosjekter/lunchportalen-16no/docs/rc/phase17menu2/evidence/warm-seed-status.json";
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log("RESULT", JSON.stringify(out));
