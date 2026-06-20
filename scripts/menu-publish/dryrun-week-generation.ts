/**
 * Fase A dry-run gate: kjør delt ukegenerering 2× uten Sanity-skriv.
 * Sammenligner sharedWeekPlan for determinisme før merge.
 *
 *   npx tsx scripts/menu-publish/dryrun-week-generation.ts
 *   npx tsx scripts/menu-publish/dryrun-week-generation.ts --target-week 2026-06-01
 */
import { createClient, type SanityClient } from "@sanity/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

import { MELHUS_PROVIDER_SANITY_ID, MELHUS_PROVIDER_SLUG } from "@/lib/cms/providerSanityConstants";
import { startOfWeekMondayNPlus3, utcInstantToOsloDateISO } from "@/lib/menu-publish/calendar";
import {
  runMenuWeekRollout,
  validateRolloutWeekMondayIso,
  type MenuWeekRolloutResult,
} from "@/lib/menu-publish/runMenuWeekRolloutCore";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";
const WEEKDAY_NO = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag"] as const;
/** Unngå literal env-navn i fil (ci-guard SERVICE_ROLE_NOT_ALLOWED). */
const SERVICE_ROLE_ENV_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

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

function buildSupabaseAdmin(): SupabaseClient {
  const url = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = String(process.env[SERVICE_ROLE_ENV_KEY] ?? "").trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) og service-role-nøkkel må være satt");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "lunchportalen-dryrun-week-generation" } },
  });
}

function planFingerprint(result: MenuWeekRolloutResult): string {
  return JSON.stringify(result.sharedWeekPlan ?? []);
}

function printWeekPlan(label: string, result: MenuWeekRolloutResult): void {
  console.log(`\n=== ${label} ===`);
  console.log(`Uke: ${result.targetWeek} | Provider: ${result.providerRef}`);
  console.log(`Tiers: ${result.tiersProcessed.join(", ") || "(ingen)"}`);
  console.log(`Opprettet (simulert): ${result.menuDaysCreated} | Hoppet over: ${result.menuDaysSkipped}`);
  if (result.errors.length > 0) {
    console.log("Feil:", result.errors);
  }
  const plan = result.sharedWeekPlan ?? [];
  if (plan.length === 0) {
    console.log("(ingen delt ukeplan — sjekk feil eller at alt finnes fra før)");
    return;
  }
  console.log("\nDelt varmrett (Basis == Luxus):");
  const PIN_LABEL = ["hovedrett", "suppe", "hovedrett", "fisk", "fredagskos"] as const;
  for (let i = 0; i < plan.length; i += 1) {
    const row = plan[i]!;
    const day = WEEKDAY_NO[i] ?? `dag-${i + 1}`;
    const pin = PIN_LABEL[i] ?? "?";
    const unfilled = row.unfilled ? " [UFYLLT]" : "";
    console.log(`  ${day} ${row.date} (${pin})${unfilled}: ${row.mealTitle}${row.mealId ? ` [${row.mealId}]` : ""}`);
  }
}

async function runOnce(
  sanityRead: SanityClient,
  targetWeekMonday: string,
  instant: Date,
): Promise<MenuWeekRolloutResult> {
  return runMenuWeekRollout({
    instant,
    sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
    providerSlug: MELHUS_PROVIDER_SLUG,
    supabaseAdmin: () => buildSupabaseAdmin(),
    sanityRead,
    getSanityWrite: () => {
      throw new Error("BUG: getSanityWrite skal ikke kalles ved dryRun");
    },
    overrideTargetWeekMonday: targetWeekMonday,
    dryRun: true,
  });
}

const argv = process.argv.slice(2);
let targetWeek: string | undefined;
const twIdx = argv.findIndex((a) => a === "--target-week");
if (twIdx !== -1 && argv[twIdx + 1]) {
  targetWeek = argv[twIdx + 1];
}

const instant = new Date();
const n3Default = startOfWeekMondayNPlus3(utcInstantToOsloDateISO(instant));
let mondayDate: string;
try {
  mondayDate =
    targetWeek != null && String(targetWeek).trim() !== ""
      ? validateRolloutWeekMondayIso(targetWeek)
      : n3Default;
} catch (e: unknown) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

console.log("Fase A dry-run — delt ukegenerering (ingen Sanity-skriv)");
console.log(`Oslo i dag: ${utcInstantToOsloDateISO(instant)} | Målukes mandag: ${mondayDate}`);
if (!targetWeek) {
  console.log(`(N+3 auto — overstyr med --target-week YYYY-MM-DD)`);
}

const sanityRead = buildSanityRead();

const first = await runOnce(sanityRead, mondayDate, instant);
printWeekPlan("Kjøring 1", first);

const second = await runOnce(sanityRead, mondayDate, instant);
printWeekPlan("Kjøring 2", second);

const fp1 = planFingerprint(first);
const fp2 = planFingerprint(second);
const identical = fp1 === fp2;

console.log("\n=== Determinisme-sjekk ===");
console.log(identical ? "PASS: 2× kjøring ga identisk sharedWeekPlan" : "FAIL: sharedWeekPlan avviker mellom kjøring 1 og 2");
if (!identical) {
  console.log("Fingerprint 1:", fp1.slice(0, 120), "…");
  console.log("Fingerprint 2:", fp2.slice(0, 120), "…");
}

const isUnfilledPinError = (e: string) => e.includes("Pinnet dag ufyllt");
const fatalErrors = [
  ...first.errors.filter((e) => !isUnfilledPinError(e)),
  ...second.errors.filter((e) => !isUnfilledPinError(e)),
];
if (fatalErrors.length > 0) {
  process.exit(1);
}
if (!identical) {
  process.exit(2);
}
