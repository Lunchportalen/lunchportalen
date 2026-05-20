/**
 * MP5 — Revert Patch 12 tier migration: LUXUS → ENTERPRISE on menuDay (+ enterprise productPlan name).
 *
 * Candidates: Melhus provider menuDays currently LUXUS that Patch 12 migrated from ENTERPRISE
 * (identified by Patch 12 migration window + provider scope; idempotent skip if already ENTERPRISE).
 *
 * Usage:
 *   npx tsx studio/scripts/revert-enterprise-tier.ts --dry-run [--dataset staging]
 *   npx tsx studio/scripts/revert-enterprise-tier.ts --confirm [--dataset staging]
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const MELHUS_PROVIDER_SANITY_ID = "11111111-1111-1111-1111-111111111111";
/** Patch 12 content migration date (UTC day window). */
const PATCH12_DAY_START = "2026-05-20T00:00:00.000Z";
const PATCH12_DAY_END = "2026-05-20T23:59:59.999Z";

type RevertStrategy = "id-segment" | "patch12-window";

type Args = { dryRun: boolean; confirm: boolean; dataset: string; strategy: RevertStrategy };

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
  const strategy: RevertStrategy = argv.includes("--strategy")
    ? (argv[argv.indexOf("--strategy") + 1] as RevertStrategy)
    : "id-segment";
  if (strategy !== "id-segment" && strategy !== "patch12-window") {
    console.error('Invalid --strategy (use "id-segment" or "patch12-window")');
    process.exit(1);
  }
  return { dryRun, confirm, dataset, strategy };
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

type MenuDayRow = { _id: string; planTier?: string; _updatedAt?: string; provider?: { _ref?: string } };
type ProductPlanRow = { _id: string; name?: string; provider?: { _ref?: string } };

function auditLog(dataset: string, entry: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), dataset, ...entry });
  console.log(`[audit] ${line}`);
  const logPath = path.resolve(process.cwd(), "docs/audit/mp5-enterprise-tier-revert.log");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`, "utf8");
}

function isEnterpriseIdSegment(id: string): boolean {
  return /-ENTERPRISE-/i.test(id);
}

async function main() {
  const { dryRun, confirm, dataset, strategy } = parseArgs();
  const client = clientFor(dataset);
  const mode = dryRun ? "DRY-RUN" : "CONFIRM";

  console.log(`[revert-enterprise-tier] ${mode} dataset=${dataset} strategy=${strategy}`);

  const menuFetched = await client.fetch<MenuDayRow[]>(
    strategy === "patch12-window"
      ? `*[
          _type == "menuDay" &&
          !(_id in path("drafts.**")) &&
          planTier == "LUXUS" &&
          provider._ref == $providerRef &&
          _updatedAt >= $start &&
          _updatedAt <= $end
        ]{ _id, planTier, _updatedAt, provider, date, category }`
      : `*[
          _type == "menuDay" &&
          !(_id in path("drafts.**")) &&
          planTier == "LUXUS" &&
          provider._ref == $providerRef
        ]{ _id, planTier, _updatedAt, provider, date, category }`,
    {
      providerRef: MELHUS_PROVIDER_SANITY_ID,
      start: PATCH12_DAY_START,
      end: PATCH12_DAY_END,
    },
  );

  const menuCandidates =
    strategy === "patch12-window"
      ? menuFetched
      : menuFetched.filter((d) => isEnterpriseIdSegment(d._id));

  const planCandidates = await client.fetch<ProductPlanRow[]>(
    `*[
      _type == "productPlan" &&
      !(_id in path("drafts.**")) &&
      name == "luxus" &&
      provider._ref == $providerRef
    ]{ _id, name, provider }`,
    { providerRef: MELHUS_PROVIDER_SANITY_ID },
  );

  const enterpriseMenuCount = await client.fetch<number>(
    `count(*[_type == "menuDay" && !(_id in path("drafts.**")) && planTier == "ENTERPRISE"])`,
  );
  const luxusMenuCount = await client.fetch<number>(
    `count(*[_type == "menuDay" && !(_id in path("drafts.**")) && planTier == "LUXUS"])`,
  );

  console.log("--- Discovery ---");
  if (strategy === "id-segment") {
    console.log(`menuDay LUXUS candidates (Melhus, _id contains -ENTERPRISE-): ${menuCandidates.length}`);
    console.log(`(Melhus LUXUS total in dataset: ${menuFetched.length}; use --strategy patch12-window only with explicit approval)`);
  } else {
    console.log(`menuDay LUXUS candidates (Melhus, Patch 12 day window): ${menuCandidates.length}`);
  }
  console.log(`productPlan luxus→enterprise candidates (Melhus): ${planCandidates.length}`);
  console.log(`menuDay ENTERPRISE count (current): ${enterpriseMenuCount}`);
  console.log(`menuDay LUXUS count (current): ${luxusMenuCount}`);

  if (menuCandidates.length === 0 && planCandidates.length === 0) {
    console.log("Nothing to revert.");
    return;
  }

  if (dryRun) {
    for (const doc of menuCandidates.slice(0, 10)) {
      console.log(`  menuDay ${doc._id} tier=${doc.planTier} updated=${doc._updatedAt}`);
    }
    if (menuCandidates.length > 10) console.log(`  … and ${menuCandidates.length - 10} more menuDay docs`);
    for (const doc of planCandidates) {
      console.log(`  productPlan ${doc._id} name=${doc.name}`);
    }
    console.log("Dry-run complete. Use --confirm to apply.");
    return;
  }

  let menuReverted = 0;
  let menuSkipped = 0;
  for (const doc of menuCandidates) {
    if (String(doc.planTier ?? "").toUpperCase() === "ENTERPRISE") {
      menuSkipped += 1;
      continue;
    }
    const oldTier = doc.planTier ?? "LUXUS";
    await client.patch(doc._id).set({ planTier: "ENTERPRISE" }).commit();
    menuReverted += 1;
    auditLog(dataset, {
      action: "menuDay_tier_revert",
      documentId: doc._id,
      oldTier,
      newTier: "ENTERPRISE",
    });
  }

  let planReverted = 0;
  for (const doc of planCandidates) {
    if (String(doc.name ?? "").toLowerCase() === "enterprise") continue;
    const oldName = doc.name ?? "luxus";
    await client.patch(doc._id).set({ name: "enterprise" }).commit();
    planReverted += 1;
    auditLog(dataset, {
      action: "productPlan_name_revert",
      documentId: doc._id,
      oldName,
      newName: "enterprise",
    });
  }

  const enterpriseAfter = await client.fetch<number>(
    `count(*[_type == "menuDay" && !(_id in path("drafts.**")) && planTier == "ENTERPRISE"])`,
  );

  console.log("--- Confirm result ---");
  console.log(`menuDay LUXUS→ENTERPRISE: ${menuReverted} (skipped ${menuSkipped})`);
  console.log(`productPlan luxus→enterprise: ${planReverted}`);
  console.log(`menuDay ENTERPRISE count after: ${enterpriseAfter}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
