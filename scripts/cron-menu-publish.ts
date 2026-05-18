/**
 * Kjør menu-week-rollout lokalt (samme kjerne som cron) med valgfri dry-run.
 *
 * pnpm tsx scripts/cron-menu-publish.ts --target-week 2026-05-18 --dry-run
 * npm run cron:menu-publish -- --target-week 2026-05-18 --dry-run
 */
import { createClient, type SanityClient } from "@sanity/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

import {
  runMenuWeekRollout,
  validateRolloutWeekMondayIso,
} from "@/lib/menu-publish/runMenuWeekRolloutCore";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";

function logSanitySnapshotBeforeRollout(label: string): void {
  const apiVersion =
    String(process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "").trim() || API_VERSION;
  const tokenPresent = Boolean(
    String(
      process.env.SANITY_READ_TOKEN ??
        process.env.SANITY_WRITE_TOKEN ??
        process.env.SANITY_TOKEN ??
        process.env.SANITY_API_TOKEN ??
        "",
    ).trim(),
  );
  console.log(`[${label}] sanity snapshot (før fetchMealIdeaBank / rollout):`, {
    NEXT_PUBLIC_SANITY_PROJECT_ID: String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "").trim() || "(mangler)",
    NEXT_PUBLIC_SANITY_DATASET: String(process.env.NEXT_PUBLIC_SANITY_DATASET ?? "").trim() || "(mangler)",
    apiVersion,
    useCdn: false,
    sanityReadTokenConfigured: tokenPresent,
  });
  console.log(
    "[sammenlign] debug-skript forventet typisk: dataset production, projectId f3vuhd2f (eller env-styrt NEXT_PUBLIC_SANITY_PROJECT_ID), apiVersion 2024-01-01, useCdn false, token satt",
  );
  console.log("");
}

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
  /** Samme som `sanityServer` (cron): useCdn false + token når satt (publisert+ev. tilgangskontrollert datasett). */
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

function buildSanityWrite(): SanityClient {
  const token = String(
    process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_TOKEN ?? process.env.SANITY_API_TOKEN ?? "",
  ).trim();
  if (!token) {
    throw new Error("SANITY_WRITE_TOKEN (eller SANITY_TOKEN / SANITY_API_TOKEN) mangler");
  }
  const projectId = requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const dataset = requireEnv("NEXT_PUBLIC_SANITY_DATASET");
  const apiVersion =
    String(process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "").trim() || API_VERSION;
  return createClient({ projectId, dataset, apiVersion, token, useCdn: false });
}

function buildSupabaseAdmin(): SupabaseClient {
  const url = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) og SUPABASE_SERVICE_ROLE_KEY må være satt");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "lunchportalen-cron-menu-publish" } },
  });
}

let sanityWriteSingleton: SanityClient | null = null;
function getSanityWrite(): SanityClient {
  if (!sanityWriteSingleton) sanityWriteSingleton = buildSanityWrite();
  return sanityWriteSingleton;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
let targetWeek: string | undefined;
const twIdx = argv.findIndex((a) => a === "--target-week");
if (twIdx !== -1 && argv[twIdx + 1]) {
  targetWeek = argv[twIdx + 1];
}

if (!targetWeek || !/^\d{4}-\d{2}-\d{2}$/.test(targetWeek)) {
  console.error("Bruk: npm run cron:menu-publish -- --target-week 2026-05-18 [--dry-run]");
  process.exit(1);
}

let mondayDate: string;
try {
  mondayDate = validateRolloutWeekMondayIso(targetWeek);
} catch (e: unknown) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const sanityRead = buildSanityRead();
logSanitySnapshotBeforeRollout("cron:menu-publish");
if (!dryRun) {
  try {
    getSanityWrite();
  } catch (e: unknown) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

console.log(`Rollout ${dryRun ? "(DRY-RUN) " : ""}uke ${mondayDate}`);
console.log("");

const result = await runMenuWeekRollout({
  supabaseAdmin: () => buildSupabaseAdmin(),
  sanityRead,
  getSanityWrite: dryRun
    ? () => {
        throw new Error("BUG: getSanityWrite skal ikke kalles ved dryRun");
      }
    : getSanityWrite,
  overrideTargetWeekMonday: mondayDate,
  dryRun,
});

console.log(JSON.stringify(result, null, 2));
if (result.errors.length > 0) {
  process.exit(1);
}
