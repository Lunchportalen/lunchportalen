/**
 * PHASE 17MENU — Seed country-scoped lunchCategory stubs into Sanity (staging dataset).
 * Does not publish to production traffic. Idempotent createOrReplace by country + category.
 *
 * npm run sanity:seed-phase17menu-universes -- --dry-run
 * NEXT_PUBLIC_SANITY_DATASET=staging npm run sanity:seed-phase17menu-universes
 */
import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

import { requireSanityProjectIdFromEnv } from "./sanityProjectEnv";
import { PACKAGE_ORDERABLE_CATEGORIES } from "../../lib/menu/canonicalPackageCategories";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
] as const;

const CATEGORY_META: Record<
  string,
  { legacyKey: string; title: string; luxusOnly?: boolean }
> = {
  sandwich: { legacyKey: "paasmurt", title: "Sandwich" },
  salad_box: { legacyKey: "salatboks", title: "Salad box" },
  warm_meal: { legacyKey: "varmrett", title: "Warm meal" },
  sushi: { legacyKey: "sushi", title: "Sushi", luxusOnly: true },
  poke_bowl: { legacyKey: "pokebowl", title: "Poke bowl", luxusOnly: true },
  thai: { legacyKey: "thaimat", title: "Thai", luxusOnly: true },
};

function slug(current: string) {
  return { _type: "slug" as const, current };
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const token =
    process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_TOKEN ?? process.env.SANITY_API_TOKEN;
  if (!token?.trim()) {
    console.error("FAIL: SANITY_WRITE_TOKEN missing");
    process.exit(1);
  }
  const projectId = requireSanityProjectIdFromEnv();
  const dataset =
    process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
  if (dataset === "production" && !process.argv.includes("--allow-production")) {
    console.error("FAIL: refusing production dataset without --allow-production");
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    token: token.trim(),
    useCdn: false,
  });

  const docs = [];
  for (const cc of COUNTRIES) {
    let order = 1;
    for (const cat of PACKAGE_ORDERABLE_CATEGORIES.LUXUS) {
      const meta = CATEGORY_META[cat];
      const tiers = meta.luxusOnly ? ["LUXUS", "ENTERPRISE"] : ["BASIS", "LUXUS", "ENTERPRISE"];
      docs.push({
        _id: `lunchCategory-${cc.toLowerCase()}-${cat}`,
        _type: "lunchCategory",
        countryCode: cc,
        menuProfileId: `market_${cc.toLowerCase()}`,
        canonicalCategoryKey: cat,
        key: slug(meta.legacyKey),
        title: `${cc} ${meta.title}`,
        displayOrder: order++,
        allowedPlanTiers: tiers,
        items:
          cat === "warm_meal"
            ? []
            : [
                {
                  _key: `${cc.toLowerCase()}-${cat}-a`,
                  slug: slug(`${cc.toLowerCase()}-${cat}-a`),
                  title: `${cc} ${meta.title} A`,
                  allergens: ["declared"],
                  allowedPlanTiers: tiers,
                },
                {
                  _key: `${cc.toLowerCase()}-${cat}-b`,
                  slug: slug(`${cc.toLowerCase()}-${cat}-b`),
                  title: `${cc} ${meta.title} B`,
                  allergens: ["declared"],
                  allowedPlanTiers: tiers,
                },
              ],
        isActive: true,
      });
    }
  }

  console.log(`Sanity ${projectId}/${dataset}: ${docs.length} country lunchCategory docs`);
  if (dry) {
    console.log(`[dry-run] first=${docs[0]?._id} last=${docs[docs.length - 1]?._id}`);
    process.exit(0);
  }

  // Batched transactions (Sanity limit)
  const chunk = 50;
  for (let i = 0; i < docs.length; i += chunk) {
    const tx = client.transaction();
    for (const doc of docs.slice(i, i + chunk)) tx.createOrReplace(doc);
    await tx.commit();
  }
  console.log(`OK: seeded ${docs.length} documents`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
