/**
 * ISOLERT V2-filter: kun norsk sesong (ingen winter/spring-alias),
 * og estimatedCostPerPortion < 90 (streng, før V3 <=-fix).
 *
 * npm run debug:v2-meal-bank
 */
import { createClient, type SanityClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

import { MEAL_BANK_TARGET_PRICE, mealBankCostTierClause, getCurrentNorwegianSeason } from "@/lib/menu-publish/mealIdeaBankQuery";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";

function requireEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Mangler env: ${name}`);
  return v;
}

function buildSanityRead(): SanityClient {
  const projectId = requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const dataset = requireEnv("NEXT_PUBLIC_SANITY_DATASET");
  const apiVersion =
    String(process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "").trim() || API_VERSION;
  const token = String(
    process.env.SANITY_READ_TOKEN ??
      process.env.SANITY_WRITE_TOKEN ??
      process.env.SANITY_TOKEN ??
      process.env.SANITY_API_TOKEN ??
      "",
  ).trim();
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: token || undefined,
  });
}

function interpolateParams(groqInner: string, params: Record<string, unknown>): string {
  let s = groqInner;
  const keys = Object.keys(params).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const v = params[k];
    const val = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
    s = s.split(`$${k}`).join(val);
  }
  return s;
}

/** V2 (pre-V3): norsk currentSeason only, strict < 90. */
function mealIdeaBankFilterGroqV2(tier: "BASIS" | "LUXUS", includePremium: boolean): string {
  const costPart = mealBankCostTierClause(includePremium);
  const enterpriseOnly = `$tier in allowedPlanTiers`;
  const costCap = `defined(estimatedCostPerPortion) && estimatedCostPerPortion < ${MEAL_BANK_TARGET_PRICE}`;
  const seasonClause = `(!defined(season) || count(season) == 0 || "helår" in season || $currentSeason in season)`;
  return `_type == "mealIdea" && isActive == true && ${costCap} && ${enterpriseOnly} && ${costPart} && ${seasonClause}`;
}

const clock = new Date();
const client = buildSanityRead();
const dataset = requireEnv("NEXT_PUBLIC_SANITY_DATASET");
const projectId = requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
const currentSeason = getCurrentNorwegianSeason(clock);

console.log("--- debug-v2-only ( norsk sesong + cost < 90, ingen EN-alias ) ---");
console.log("NEXT_PUBLIC_SANITY_DATASET:", dataset);
console.log("projectId:", projectId);
console.log("clock ISO:", clock.toISOString(), "| currentSeason (no):", currentSeason);
console.log("");

for (const tier of ["BASIS", "LUXUS"] as const) {
  const inner = mealIdeaBankFilterGroqV2(tier, false);
  const params = { currentSeason, tier };
  const count = await client.fetch<number>(`count(*[${inner}])`, params);
  const sample = await client.fetch<
    Array<{ _id?: string; season?: string[]; costTier?: string; estimatedCostPerPortion?: number }>
  >(`*[${inner}]{ _id, season, costTier, estimatedCostPerPortion }[0...3]`, params);

  console.log(`== ${tier} ==`);
  console.log("count:", count);
  console.log("first 3:", JSON.stringify(sample, null, 2));
  console.log("params:", JSON.stringify(params));
  console.log("filter (interpolated):", interpolateParams(inner, params));
  console.log("");
}
