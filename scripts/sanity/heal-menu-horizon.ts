/**
 * Engangs / manuell backfill: menuDay (varmrett) for en valgt uke (mandag).
 *
 * npm run sanity:heal-menu-horizon -- 2026-05-18
 * npm run sanity:heal-menu-horizon -- 2026-05-18 --dry-run
 *
 * Idempotent: eksisterende menuDay for dato/tier hoppes over.
 * Les-klient som `sanityServer`: useCdn=false + token når satt (for ACL/dataset som krever det).
 */
import { createClient, type SanityClient } from "@sanity/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

import { MELHUS_PROVIDER_SANITY_ID, MELHUS_PROVIDER_SLUG } from "@/lib/cms/providerSanityConstants";
import {
  runMenuWeekRollout,
  validateRolloutWeekMondayIso,
} from "@/lib/menu-publish/runMenuWeekRolloutCore";

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

function buildSanityWrite(): SanityClient {
  const token = String(
    process.env.SANITY_WRITE_TOKEN ??
      process.env.SANITY_TOKEN ??
      process.env.SANITY_API_TOKEN ??
      "",
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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": "lunchportalen-heal-menu-horizon" },
    },
  });
}

let sanityWriteSingleton: SanityClient | null = null;
function getSanityWrite(): SanityClient {
  if (!sanityWriteSingleton) sanityWriteSingleton = buildSanityWrite();
  return sanityWriteSingleton;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const dateArg = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

// Eksplisitt provider-scope (singleProviderSeedMode): standard = Melhus seed-provider,
// overstyrbart med --provider-ref <uuid>. Kjernen feiler fail-closed uten provider.
let sanityProviderRef = MELHUS_PROVIDER_SANITY_ID;
let providerSlug: string | null = MELHUS_PROVIDER_SLUG;
const prIdx = argv.findIndex((a) => a === "--provider-ref");
if (prIdx !== -1) {
  const ref = String(argv[prIdx + 1] ?? "").trim();
  if (!ref) {
    console.error("Bruk: --provider-ref <sanity provider _id / supabase providers.id>");
    process.exit(1);
  }
  sanityProviderRef = ref;
  providerSlug = null;
}

if (!dateArg) {
  console.error("Bruk: npm run sanity:heal-menu-horizon -- 2026-05-18 [--dry-run]");
  console.error("Argument må være mandag i ønsket uke (YYYY-MM-DD).");
  process.exit(1);
}

let mondayDate: string;
try {
  mondayDate = validateRolloutWeekMondayIso(dateArg);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(1);
}

console.log(`Heal: kjører menu-week-rollout for uke som starter ${mondayDate}${dryRun ? " (DRY-RUN)" : ""}`);
console.log(
  `Provider-scope: ${sanityProviderRef}${sanityProviderRef === MELHUS_PROVIDER_SANITY_ID ? " (Melhus seed-provider)" : ""}`,
);
console.log("(Idempotent: skipper menuDay-docs som allerede finnes for provideren.)");
console.log("");

let sanityRead: SanityClient;
try {
  sanityRead = buildSanityRead();
  if (!dryRun) getSanityWrite();
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Klient-oppsett feilet:", msg);
  process.exit(1);
}

const result = await runMenuWeekRollout({
  sanityProviderRef,
  providerSlug,
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
