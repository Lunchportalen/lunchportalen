/**
 * PHASE 17MENU.2 — Seed country warm-dish mealIdea stubs into Sanity staging
 * from phase17menu1 warm-bank evidence (not production).
 *
 * Requires SANITY_WRITE_TOKEN (or use Sanity MCP equivalent).
 * Refuses production dataset without --allow-production.
 */
import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

import { requireSanityProjectIdFromEnv } from "./sanityProjectEnv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
] as const;

async function main() {
  const dry = process.argv.includes("--dry-run");
  const token =
    process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_TOKEN ?? process.env.SANITY_API_TOKEN;
  if (!token?.trim()) {
    console.error("FAIL: SANITY_WRITE_TOKEN missing (use Sanity MCP seed path if no local token)");
    process.exit(1);
  }
  const projectId = requireSanityProjectIdFromEnv();
  const dataset =
    process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "staging";
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

  const docs: Record<string, unknown>[] = [];
  for (const cc of COUNTRIES) {
    const bankPath = path.join(
      process.cwd(),
      "docs/rc/phase17menu1/evidence/warm-banks",
      `${cc}.json`,
    );
    if (!fs.existsSync(bankPath)) {
      console.error(`FAIL: missing warm bank ${bankPath}`);
      process.exit(1);
    }
    const bank = JSON.parse(fs.readFileSync(bankPath, "utf8")) as {
      dishes: Array<{
        dish_key: string;
        recipe_version: string;
        generation_eligible: boolean;
        locales: string[];
        portion_weight_g: number;
        contribution_bps: number;
      }>;
    };
    for (const d of bank.dishes) {
      const id = `mealIdea-${d.dish_key}`;
      docs.push({
        _id: id,
        _type: "mealIdea",
        countryCode: cc,
        menuProfileId: `market_${cc.toLowerCase()}`,
        dishKey: { _type: "slug", current: d.dish_key },
        title: `${cc} warm dish ${d.dish_key.replace(/^[a-z]+-warm-/, "")}`,
        category: "varmrett",
        description: `Phase17MENU2 staging seed. recipe_version=${d.recipe_version}; portion_g=${d.portion_weight_g}; contribution_bps=${d.contribution_bps}. NOT generation-eligible until full production-ready recipe fields are completed.`,
        tags: ["fish", "meat", "veg"].slice(0, 1 + (Number(d.dish_key.slice(-2)) % 3)),
        allergens: [],
        costTier: "standard",
        isActive: true,
      });
    }
  }

  console.log(`Sanity ${projectId}/${dataset}: ${docs.length} mealIdea docs from warm banks`);
  if (dry) {
    console.log(`[dry-run] first=${docs[0]?._id} last=${docs[docs.length - 1]?._id}`);
    process.exit(0);
  }

  const chunk = 50;
  for (let i = 0; i < docs.length; i += chunk) {
    const tx = client.transaction();
    for (const doc of docs.slice(i, i + chunk)) tx.createOrReplace(doc);
    await tx.commit();
    console.log(`committed ${Math.min(i + chunk, docs.length)}/${docs.length}`);
  }
  console.log(`OK: seeded ${docs.length} mealIdea documents`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
