import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

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
const client = createClient({
  projectId: "4udoq5d8",
  dataset: "staging",
  apiVersion: "2024-01-01",
  token: env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];
const bankDir =
  "C:/prosjekter/lunchportalen-16no/docs/rc/phase17menu1/evidence/warm-banks";

const ids = await client.fetch(
  `*[_type=="mealIdea" && defined(countryCode) && !(_id in path("drafts.**"))][]._id`,
);
const set = new Set(ids);
const missing = [];
const expected = [];
for (const cc of COUNTRIES) {
  const bank = JSON.parse(
    fs.readFileSync(path.join(bankDir, `${cc}.json`), "utf8"),
  );
  for (const d of bank.dishes) {
    const id = `mealIdea-${d.dish_key}`;
    expected.push(id);
    if (!set.has(id)) missing.push(id);
  }
}

const noCc = await client.fetch(
  `count(*[_type=="mealIdea" && !defined(countryCode) && !(_id in path("drafts.**"))])`,
);
const drafts = await client.fetch(
  `count(*[_type=="mealIdea" && _id in path("drafts.**")])`,
);
const mealIdeaCount = await client.fetch(
  `count(*[_type=="mealIdea" && defined(countryCode) && !(_id in path("drafts.**"))])`,
);
const countryCount = await client.fetch(
  `count(array::unique(*[_type=="mealIdea" && defined(countryCode) && !(_id in path("drafts.**"))].countryCode))`,
);
const byCountry = await client.fetch(
  `*[_type=="mealIdea" && defined(countryCode) && !(_id in path("drafts.**"))]{countryCode} | order(countryCode)`,
);
const counts = {};
for (const row of byCountry) {
  counts[row.countryCode] = (counts[row.countryCode] || 0) + 1;
}

const sample = missing.length
  ? await client.fetch(`*[_id in $ids]{_id, countryCode, title}`, {
      ids: missing.slice(0, 10).flatMap((id) => [id, `drafts.${id}`]),
    })
  : [];

console.log(
  JSON.stringify(
    {
      mealIdeaCount,
      countryCount,
      expected: expected.length,
      missing: missing.length,
      missingSample: missing.slice(0, 50),
      noCc,
      drafts,
      counts,
      sample,
    },
    null,
    2,
  ),
);
