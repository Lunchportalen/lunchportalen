/**
 * Diagnose: samme mealIdea-bank-filter som cron/CLI (fetchMealIdeaBank).
 *
 * pnpm tsx scripts/debug-meal-idea-bank.ts
 * npm run debug:meal-idea-bank
 */
import { createClient, type SanityClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

import {
  fetchMealIdeaBank,
  getCurrentNorwegianSeason,
  mealIdeaBankFilterGroq,
} from "@/lib/menu-publish/mealIdeaBankQuery";

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

const clock = new Date();
const client = buildSanityRead();
const projectId = requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
const dataset = requireEnv("NEXT_PUBLIC_SANITY_DATASET");
const currentSeason = getCurrentNorwegianSeason(clock);

console.log("--- debug-meal-idea-bank ---");
console.log("NEXT_PUBLIC_SANITY_DATASET:", dataset);
console.log("projectId:", projectId);
console.log("apiVersion:", String(process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "").trim() || API_VERSION);
console.log(
  "useCdn: false (script), token:",
  process.env.SANITY_READ_TOKEN || process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_TOKEN ? "satt" : "ikke satt",
);
console.log("clock (ISO):", clock.toISOString());
console.log("currentSeason (no):", currentSeason);
console.log("");

for (const tier of ["BASIS", "LUXUS"] as const) {
  const includePremium = false;
  const inner = mealIdeaBankFilterGroq(tier, includePremium);
  const params = { currentSeason, tier };

  const count = await client.fetch<number>(`count(*[${inner}])`, params);
  const sample = await client.fetch<
    Array<{ _id?: string; season?: string[]; costTier?: string; allowedPlanTiers?: string[] }>
  >(`*[${inner}]{ _id, season, costTier, allowedPlanTiers }[0...3]`, params);

  console.log(`== ${tier} (base pool, includePremium=false) ==`);
  console.log("count:", count);
  console.log("first 3:", JSON.stringify(sample, null, 2));
  console.log("params:", JSON.stringify(params));
  console.log("filter (interpolated):", interpolateParams(inner, params));
  console.log("");

  const rows = await fetchMealIdeaBank(client, tier, includePremium, clock);
  console.log(`fetchMealIdeaBank length: ${rows.length}`);
  console.log("");
}
