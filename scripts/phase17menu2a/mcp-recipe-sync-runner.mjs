#!/usr/bin/env node
/**
 * Prepare / track Phase 17MENU.2A recipe sync batches for Sanity MCP.
 * STAGING ONLY — never production.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SYNC_DIR = path.join(ROOT, "docs/rc/phase17menu2a/sanity-sync");
const BATCH_DIR = path.join(ROOT, "docs/rc/phase17menu2a/evidence/mcp-batches");
const STATUS_PATH = path.join(ROOT, "docs/rc/phase17menu2a/evidence/sanity-recipe-sync-status.json");

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

const PATCH_FIELDS = [
  "title", "description", "allergens", "season", "productionReadyRecipe",
  "countryCode", "dishKey", "category", "menuProfileId", "isActive",
];

function pickPatchFields(doc) {
  const set = {};
  for (const k of PATCH_FIELDS) {
    if (doc[k] !== undefined) set[k] = doc[k];
  }
  return set;
}

function prepareBatches(batchSize = 5) {
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  const manifest = { batchSize, countries: {}, totalBatches: 0, totalDocs: 0 };

  for (const cc of COUNTRIES) {
    const file = path.join(SYNC_DIR, `${cc}.ndjson`);
    const lines = fs.readFileSync(file, "utf8").split(/\n/).filter(Boolean);
    const docs = lines.map((l) => JSON.parse(l));
    const batches = [];
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const batchIndex = batches.length;
      const batchId = `${cc}-${String(batchIndex).padStart(3, "0")}`;
      const payload = {
        batchId,
        country: cc,
        batchIndex,
        ids: chunk.map((d) => d._id),
        createDocuments: chunk.map((d) => ({ type: "mealIdea", content: d })),
        patchDocuments: Object.fromEntries(
          chunk.map((d) => [d._id, { patches: [{ set: pickPatchFields(d) }] }]),
        ),
      };
      const outPath = path.join(BATCH_DIR, `${batchId}.json`);
      fs.writeFileSync(outPath, JSON.stringify(payload));
      batches.push({ batchId, ids: payload.ids, path: outPath });
    }
    manifest.countries[cc] = { docCount: docs.length, batchCount: batches.length, batches: batches.map((b) => b.batchId) };
    manifest.totalBatches += batches.length;
    manifest.totalDocs += docs.length;
  }

  fs.writeFileSync(path.join(BATCH_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(BATCH_DIR, "manifest.json"), "utf8"));
}

function loadBatch(batchId) {
  return JSON.parse(fs.readFileSync(path.join(BATCH_DIR, `${batchId}.json`), "utf8"));
}

function writeStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

function initStatus() {
  const manifest = loadManifest();
  const status = {
    projectId: "4udoq5d8",
    dataset: "staging",
    syncedAt: null,
    sourceTotalDocs: manifest.totalDocs,
    publishedWithProductionReadyRecipe: null,
    countriesPublished: {},
    batchesCompleted: [],
    batchesFailed: [],
    remainingCountries: COUNTRIES,
    notes: [],
  };
  writeStatus(status);
  return status;
}

function markBatchComplete(batchId, mode, ids) {
  let status = {};
  try {
    status = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"));
  } catch {
    status = initStatus();
  }
  status.batchesCompleted.push({ batchId, mode, count: ids.length, ids });
  status.syncedAt = new Date().toISOString();
  writeStatus(status);
}

function markBatchFailed(batchId, error) {
  let status = {};
  try {
    status = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"));
  } catch {
    status = initStatus();
  }
  status.batchesFailed.push({ batchId, error: String(error) });
  writeStatus(status);
}

function finalizeStatus(verification) {
  let status = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"));
  status.publishedWithProductionReadyRecipe = verification.total;
  status.countriesPublished = verification.byCountry;
  status.remainingCountries = COUNTRIES.filter(
    (cc) => (verification.byCountry[cc] ?? 0) < (loadManifest().countries[cc]?.docCount ?? 55),
  );
  status.syncedAt = new Date().toISOString();
  writeStatus(status);
  console.log(JSON.stringify(status, null, 2));
}

const cmd = process.argv[2];
if (cmd === "prepare") {
  prepareBatches(Number(process.argv[3] || 5));
} else if (cmd === "init") {
  prepareBatches(5);
  initStatus();
} else if (cmd === "batch") {
  console.log(JSON.stringify(loadBatch(process.argv[3]), null, 2));
} else if (cmd === "list") {
  const m = loadManifest();
  for (const cc of COUNTRIES) {
    console.log(`${cc}: ${m.countries[cc].batchCount} batches, ${m.countries[cc].docCount} docs`);
  }
} else if (cmd === "complete") {
  markBatchComplete(process.argv[3], process.argv[4], JSON.parse(process.argv[5]));
} else if (cmd === "fail") {
  markBatchFailed(process.argv[3], process.argv[4]);
} else if (cmd === "finalize") {
  finalizeStatus(JSON.parse(process.argv[3]));
} else {
  console.log(`Usage: node mcp-recipe-sync-runner.mjs <prepare|init|batch|list|complete|fail|finalize>`);
  process.exit(1);
}
