#!/usr/bin/env node
/**
 * Sync productionReadyRecipe onto Sanity staging mealIdea docs.
 * Requires SANITY_WRITE_TOKEN. Refuses production dataset.
 *
 * NEXT_PUBLIC_SANITY_DATASET=staging node scripts/phase17menu2a/sync-recipes-sanity-staging.mjs
 */
import { createClient } from "@sanity/client";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

async function main() {
  const token =
    process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_TOKEN ?? process.env.SANITY_API_TOKEN;
  if (!token?.trim()) {
    console.error("FAIL: SANITY_WRITE_TOKEN missing — use MCP sync agent or set token");
    process.exit(2);
  }
  const projectId =
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    process.env.SANITY_PROJECT_ID ||
    "4udoq5d8";
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "staging";
  if (dataset === "production") {
    console.error("FAIL: refusing production");
    process.exit(1);
  }
  const client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    token: token.trim(),
    useCdn: false,
  });

  let total = 0;
  for (const cc of COUNTRIES) {
    const file = path.join(ROOT, "docs/rc/phase17menu2a/sanity-sync", `${cc}.ndjson`);
    const lines = fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean);
    for (let i = 0; i < lines.length; i += 25) {
      const chunk = lines.slice(i, i + 25).map((l) => JSON.parse(l));
      const tx = client.transaction();
      for (const doc of chunk) tx.createOrReplace(doc);
      await tx.commit();
      total += chunk.length;
      console.log(`${cc}: ${total} committed`);
    }
  }
  console.log(`OK: synced ${total} mealIdea recipes to ${projectId}/${dataset}`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
