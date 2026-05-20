/**
 * Patch 12 — Idempotent Melhus provider + menuDay/productPlan backfill.
 *
 * Usage:
 *   npx tsx studio/scripts/migrate-melhus-provider.ts --dry-run [--dataset staging]
 *   npx tsx studio/scripts/migrate-melhus-provider.ts --confirm [--dataset staging]
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const MELHUS_PROVIDER_SANITY_ID = "11111111-1111-1111-1111-111111111111";
const MELHUS_PROVIDER_SLUG = "melhus-catering";
const MELHUS_PROVIDER_NAME = "Melhus Catering AS";

type Args = { dryRun: boolean; confirm: boolean; dataset: string };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const confirm = argv.includes("--confirm");
  if (!dryRun && !confirm) {
    console.error("Specify exactly one mode: --dry-run or --confirm");
    process.exit(1);
  }
  if (dryRun && confirm) {
    console.error("Use only one of --dry-run or --confirm");
    process.exit(1);
  }
  const dsIdx = argv.indexOf("--dataset");
  const dataset =
    dsIdx >= 0 && argv[dsIdx + 1]
      ? argv[dsIdx + 1]
      : process.env.SANITY_STUDIO_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
  return { dryRun, confirm, dataset };
}

function clientFor(dataset: string): SanityClient {
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!projectId) throw new Error("Missing SANITY project id");
  if (!token) throw new Error("Missing SANITY_WRITE_TOKEN");
  return createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    token,
    useCdn: false,
  });
}

const providerRef = { _type: "reference" as const, _ref: MELHUS_PROVIDER_SANITY_ID };

const melhusProviderDoc = {
  _id: MELHUS_PROVIDER_SANITY_ID,
  _type: "provider" as const,
  name: MELHUS_PROVIDER_NAME,
  slug: { _type: "slug" as const, current: MELHUS_PROVIDER_SLUG },
  status: "ACTIVE" as const,
  primaryColor: "#E6B800",
  lastSyncedAt: new Date().toISOString(),
};

type MenuDayRow = { _id: string; planTier?: string; provider?: { _ref?: string } };
type ProductPlanRow = { _id: string; name?: string; provider?: { _ref?: string } };

async function main() {
  const { dryRun, dataset } = parseArgs();
  const client = clientFor(dataset);
  const mode = dryRun ? "DRY-RUN" : "CONFIRM";

  console.log(`[migrate-melhus-provider] ${mode} dataset=${dataset}`);

  const menuDays = await client.fetch<MenuDayRow[]>(
    `*[_type == "menuDay" && !(_id in path("drafts.**"))]{ _id, planTier, provider }`,
  );
  const productPlans = await client.fetch<ProductPlanRow[]>(
    `*[_type == "productPlan" && !(_id in path("drafts.**"))]{ _id, name, provider }`,
  );

  const menuNeedsProvider = menuDays.filter((d) => d.provider?._ref !== MELHUS_PROVIDER_SANITY_ID);
  const menuNeedsTierFix = menuDays.filter((d) => String(d.planTier ?? "").toUpperCase() === "ENTERPRISE");
  const plansNeedProvider = productPlans.filter((d) => d.provider?._ref !== MELHUS_PROVIDER_SANITY_ID);
  const plansNeedNameFix = productPlans.filter((d) => String(d.name ?? "").toLowerCase() === "enterprise");

  const providerExists = await client.fetch<boolean>(`*[_id == $id][0]._id != null`, {
    id: MELHUS_PROVIDER_SANITY_ID,
  });

  console.log("--- Discovery ---");
  console.log(`menuDay total: ${menuDays.length}`);
  console.log(`menuDay missing/wrong provider: ${menuNeedsProvider.length}`);
  console.log(`menuDay ENTERPRISE tier → LUXUS: ${menuNeedsTierFix.length}`);
  console.log(`productPlan total: ${productPlans.length}`);
  console.log(`productPlan missing/wrong provider: ${plansNeedProvider.length}`);
  console.log(`productPlan enterprise name → luxus: ${plansNeedNameFix.length}`);
  console.log(`provider doc exists: ${providerExists}`);

  const afterProvider = await client.fetch<number>(
    `count(*[_type == "menuDay" && !defined(provider) && !(_id in path("drafts.**"))])`,
  );
  console.log(`menuDay without provider (pre-patch count): ${afterProvider}`);

  if (dryRun) {
    console.log("--- Dry-run complete (no mutations) ---");
    return;
  }

  await client.createOrReplace(melhusProviderDoc);
  console.log("provider: createOrReplace Melhus");

  let menuPatched = 0;
  let menuTierPatched = 0;
  for (const doc of menuDays) {
    const set: Record<string, unknown> = {};
    if (doc.provider?._ref !== MELHUS_PROVIDER_SANITY_ID) {
      set.provider = providerRef;
      menuPatched += 1;
    }
    if (String(doc.planTier ?? "").toUpperCase() === "ENTERPRISE") {
      set.planTier = "LUXUS";
      menuTierPatched += 1;
    }
    if (Object.keys(set).length) {
      await client.patch(doc._id).set(set).commit();
    }
  }

  let planPatched = 0;
  let planNamePatched = 0;
  for (const doc of productPlans) {
    const set: Record<string, unknown> = {};
    if (doc.provider?._ref !== MELHUS_PROVIDER_SANITY_ID) {
      set.provider = providerRef;
      planPatched += 1;
    }
    if (String(doc.name ?? "").toLowerCase() === "enterprise") {
      set.name = "luxus";
      planNamePatched += 1;
    }
    if (Object.keys(set).length) {
      await client.patch(doc._id).set(set).commit();
    }
  }

  const remaining = await client.fetch<number>(
    `count(*[_type == "menuDay" && !defined(provider) && !(_id in path("drafts.**"))])`,
  );

  console.log("--- Confirm result ---");
  console.log(`menuDay provider set: ${menuPatched}`);
  console.log(`menuDay tier ENTERPRISE→LUXUS: ${menuTierPatched}`);
  console.log(`productPlan provider set: ${planPatched}`);
  console.log(`productPlan enterprise→luxus: ${planNamePatched}`);
  console.log(`menuDay without provider after: ${remaining}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
