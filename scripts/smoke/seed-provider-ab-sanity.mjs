#!/usr/bin/env node
/**
 * Provider A/B Sanity staging menu docs — dry-run by default.
 *
 * Creates deterministic provider B + menuDay B documents in Sanity **staging** dataset only.
 * Does nothing unless `--execute` is passed (and staging dataset + write token are set).
 *
 * Usage:
 *   node scripts/smoke/seed-provider-ab-sanity.mjs              # dry-run (default)
 *   node scripts/smoke/seed-provider-ab-sanity.mjs --execute    # write staging docs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertSanityStagingDataset,
  buildProviderAbSanityDocs,
  resolveSanityDatasetFromEnv,
} from "./provider-ab-sanity-core.mjs";

export {
  assertSanityStagingDataset,
  buildProviderAbSanityDocs,
  resolveSanityDatasetFromEnv,
} from "./provider-ab-sanity-core.mjs";

const API_VERSION = "2024-01-01";

/**
 * @param {{ execute?: boolean }} opts
 */
export async function runProviderAbSanitySeed(opts = {}) {
  const execute = opts.execute === true;
  const dataset = assertSanityStagingDataset(resolveSanityDatasetFromEnv());
  const docs = buildProviderAbSanityDocs();

  const plan = {
    mode: execute ? "execute" : "dry-run",
    dataset,
    projectId:
      String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "").trim() ||
      String(process.env.SANITY_PROJECT_ID ?? "").trim() ||
      null,
    docs: Object.keys(docs),
    menuDayIds: [docs.menuDayA._id, docs.menuDayB._id],
    note: execute
      ? "Will createOrReplace staging docs — requires SANITY_WRITE_TOKEN"
      : "No writes — pass --execute after operator approval",
  };

  if (!execute) {
    return { ...plan, payloads: docs };
  }

  const token = String(
    process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_TOKEN ?? process.env.SANITY_API_TOKEN ?? "",
  ).trim();
  if (!token) {
    throw new Error("ABORT: SANITY_WRITE_TOKEN required for --execute");
  }
  if (!plan.projectId) {
    throw new Error("ABORT: NEXT_PUBLIC_SANITY_PROJECT_ID required for --execute");
  }

  const { createClient } = await import("@sanity/client");
  const client = createClient({
    projectId: plan.projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
  });

  await client.createOrReplace(docs.providerB);
  await client.createOrReplace(docs.menuDayA);
  await client.createOrReplace(docs.menuDayB);

  return { ...plan, written: true };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const out = await runProviderAbSanitySeed({ execute });
  console.log(execute ? "PROVIDER_AB_SANITY_OK" : "PROVIDER_AB_SANITY_DRY_RUN", JSON.stringify(out, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((e) => {
    console.error("PROVIDER_AB_SANITY_FAIL", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
