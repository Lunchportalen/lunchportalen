import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";

const ALL_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
const ENTERPRISE_ONLY = ["ENTERPRISE"] as const;

type CostTier = "BUDGET" | "STANDARD" | "PREMIUM" | string | undefined;

type MealRow = {
  _id: string;
  costTier?: CostTier;
  allowedPlanTiers?: string[] | null;
};

function safeEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function normalizeTiers(v: string[] | null | undefined): string[] {
  if (!Array.isArray(v)) return [];
  return [...v].map((x) => String(x)).filter(Boolean).sort();
}

function targetTiersFor(costTier: CostTier): Array<"BASIS" | "LUXUS" | "ENTERPRISE"> {
  if (costTier === "PREMIUM") return [...ENTERPRISE_ONLY];
  return [...ALL_TIERS];
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  const tokenRaw =
    process.env.SANITY_WRITE_TOKEN ??
    process.env.SANITY_TOKEN ??
    process.env.SANITY_API_TOKEN;

  if (!tokenRaw || !tokenRaw.trim()) {
    console.error("FAIL: Sanity write-token mangler i env.");
    console.error(
      "Set SANITY_WRITE_TOKEN, SANITY_TOKEN eller SANITY_API_TOKEN. Eksempel:",
    );
    console.error('$env:SANITY_WRITE_TOKEN="<token>"; npm run sanity:migrate-mealidea-allowed-tiers');
    process.exit(1);
  }

  const token = tokenRaw.trim();

  const projectId = safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") || safeEnv("SANITY_PROJECT_ID") || "4udoq5d8";
  const dataset = safeEnv("NEXT_PUBLIC_SANITY_DATASET") || safeEnv("SANITY_DATASET") || "production";

  const client = createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
  });

  const rows = await client.fetch<MealRow[]>(
    `*[_type == "mealIdea" && !(_id in path("drafts.**"))]{
      _id,
      costTier,
      allowedPlanTiers
    }`,
  );

  const total = rows.length;
  console.log(`Sanity: ${projectId}/${dataset}`);
  console.log(`mealIdea i banken (uten kladd): ${total}`);

  if (total < 10) {
    console.error("STOPP: mealIdea-banken er tom eller har færre enn 10 dokumenter (uventet tilstand).");
    process.exit(1);
  }

  const toPatch: Array<{ _id: string; next: Array<"BASIS" | "LUXUS" | "ENTERPRISE"> }> = [];
  let alreadyOk = 0;

  for (const row of rows) {
    const next = targetTiersFor(row.costTier);
    const cur = normalizeTiers(row.allowedPlanTiers);
    const want = normalizeTiers(next);
    if (cur.join("|") === want.join("|")) {
      alreadyOk += 1;
      continue;
    }
    toPatch.push({ _id: row._id, next });
  }

  const nEnterpriseOnly = toPatch.filter((p) => p.next.length === 1 && p.next[0] === "ENTERPRISE").length;
  const nAllTiers = toPatch.filter((p) => p.next.length === 3).length;

  console.log(`Allerede korrekt (idempotent hopp): ${alreadyOk}`);
  console.log(`Skal patche: ${toPatch.length} (alle tre tiers: ${nAllTiers}, kun ENTERPRISE: ${nEnterpriseOnly})`);

  if (isDryRun) {
    toPatch.slice(0, 15).forEach((p) => console.log(`  [dry-run] ${p._id} -> ${JSON.stringify(p.next)}`));
    if (toPatch.length > 15) console.log(`  ... og ${toPatch.length - 15} til`);
    process.exit(0);
  }

  const BATCH = 50;
  for (let i = 0; i < toPatch.length; i += BATCH) {
    const slice = toPatch.slice(i, i + BATCH);
    let tx = client.transaction();
    for (const p of slice) {
      tx = tx.patch(p._id, { set: { allowedPlanTiers: p.next } });
    }
    await tx.commit();
  }

  const tiersRows = await client.fetch<Array<{ allowedPlanTiers?: string[] | null }>>(
    `*[_type == "mealIdea" && !(_id in path("drafts.**"))]{ allowedPlanTiers }`,
  );
  let nAllTiersReport = 0;
  let mEnterpriseOnlyReport = 0;
  for (const doc of tiersRows) {
    const t = normalizeTiers(doc.allowedPlanTiers);
    const isAllThree =
      t.length === 3 && t.includes("BASIS") && t.includes("LUXUS") && t.includes("ENTERPRISE");
    if (isAllThree) nAllTiersReport += 1;
    if (t.length === 1 && t[0] === "ENTERPRISE") mEnterpriseOnlyReport += 1;
  }

  console.log("--- Rapport (etter patch) ---");
  console.log(`Totalt mealIdea: ${tiersRows.length}`);
  console.log(`N — tagget [BASIS, LUXUS, ENTERPRISE]: ${nAllTiersReport}`);
  console.log(`M — tagget [ENTERPRISE] kun: ${mEnterpriseOnlyReport}`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
