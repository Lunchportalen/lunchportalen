#!/usr/bin/env node
/**
 * Execute Phase 17MENU.2A recipe sync to Sanity STAGING using pre-built MCP batch payloads.
 * Mirrors MCP workflow: createOrReplace (draft) + publish. NEVER production.
 */
import { createClient } from "@sanity/client";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const LP_ROOT = path.resolve(ROOT, "..", "lunchportalen");
const BATCH_DIR = path.join(ROOT, "docs/rc/phase17menu2a/evidence/mcp-batches");
const STATUS_PATH = path.join(ROOT, "docs/rc/phase17menu2a/evidence/sanity-recipe-sync-status.json");

for (const envPath of [
  path.join(LP_ROOT, ".env.local"),
  path.join(LP_ROOT, ".env"),
  path.join(ROOT, ".env.local"),
  path.join(ROOT, ".env"),
]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const PROJECT_ID = "4udoq5d8";
const DATASET = "staging"; // hard-locked — never read from env

const token =
  process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_TOKEN ?? process.env.SANITY_API_TOKEN;
if (!token?.trim()) {
  console.error("FAIL: SANITY_WRITE_TOKEN missing");
  process.exit(2);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: "2024-01-01",
  token: token.trim(),
  useCdn: false,
});

const manifest = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, "manifest.json"), "utf8"));

const status = {
  projectId: PROJECT_ID,
  dataset: DATASET,
  syncMethod: "sanity-client-mcp-equivalent",
  syncedAt: null,
  sourceTotalDocs: manifest.totalDocs,
  batchesProcessed: 0,
  docsCreated: 0,
  docsPatched: 0,
  docsPublished: 0,
  batchesFailed: [],
  countryProgress: {},
};

async function syncBatch(batchId) {
  const batch = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, `${batchId}.json`), "utf8"));
  const ids = batch.ids;
  let mode = "create";

  const existing = await client.fetch(
    `*[_id in $ids || _id in $draftIds]._id`,
    { ids, draftIds: ids.map((id) => `drafts.${id}`) },
  );
  const hasAny = existing.length > 0;

  if (!hasAny) {
    const tx = client.transaction();
    for (const doc of batch.createDocuments.map((d) => d.content)) {
      tx.create(doc);
    }
    await tx.commit();
    status.docsCreated += ids.length;
  } else {
    mode = "patch";
    const tx = client.transaction();
    for (const [id, patchSpec] of Object.entries(batch.patchDocuments)) {
      const set = patchSpec.patches[0].set;
      tx.patch(id, (p) => p.set(set));
    }
    await tx.commit();
    status.docsPatched += ids.length;
  }

  for (const id of ids) {
    try {
      await client.action({
        actionType: "sanity.action.document.publish",
        draftId: `drafts.${id}`,
        publishedId: id,
      });
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/already published|not found|no draft/i.test(msg)) throw err;
    }
  }

  status.docsPublished += ids.length;
  status.batchesProcessed += 1;
  status.countryProgress[batch.country] = (status.countryProgress[batch.country] ?? 0) + ids.length;
  return { batchId, mode, count: ids.length };
}

async function main() {
  const filter = process.argv[2];
  const batchIds = [];
  for (const cc of Object.keys(manifest.countries)) {
    if (filter && cc !== filter && filter !== "all") continue;
    batchIds.push(...manifest.countries[cc].batches);
  }

  console.log(`Syncing ${batchIds.length} batches to ${PROJECT_ID}/${DATASET}...`);
  for (const batchId of batchIds) {
    try {
      const result = await syncBatch(batchId);
      if (status.batchesProcessed % 10 === 0 || batchId.endsWith("-010")) {
        console.log(`OK ${batchId} (${result.mode}) — ${status.docsPublished} published`);
      }
    } catch (err) {
      console.error(`FAIL ${batchId}:`, err?.message || err);
      status.batchesFailed.push({ batchId, error: String(err?.message || err) });
    }
  }

  const verification = await client.fetch(`{
    "total": count(*[_type=="mealIdea" && defined(productionReadyRecipe)]),
    "byCountry": *[_type=="mealIdea" && defined(productionReadyRecipe)]{
      countryCode
    } | order(countryCode asc) {
      "country": countryCode,
      "count": count(*[_type=="mealIdea" && defined(productionReadyRecipe) && countryCode==^.countryCode])
    }
  }`);

  const byCountryMap = {};
  for (const row of verification.byCountry ?? []) {
    byCountryMap[row.country] = row.count;
  }
  verification.byCountry = byCountryMap;

  status.publishedWithProductionReadyRecipe = verification.total;
  status.countriesPublished = verification.byCountry;
  status.remainingCountries = Object.keys(manifest.countries).filter(
    (cc) => (verification.byCountry?.[cc] ?? 0) < manifest.countries[cc].docCount,
  );
  status.syncedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
  console.log("VERIFICATION:", JSON.stringify(verification, null, 2));
  console.log(`DONE: ${status.docsPublished} docs published, ${verification.total} with productionReadyRecipe`);
  if (status.batchesFailed.length) process.exit(1);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
