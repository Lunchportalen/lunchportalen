/**
 * Engangs / manuell backfill: menuDay (varmrett) for en valgt uke (mandag).
 *
 * npm run sanity:heal-menu-horizon -- 2026-05-18
 *
 * Idempotent: eksisterende menuDay for dato/tier hoppes over.
 * Bruker lokale Sanity/Supabase-klienter (unngår server-only app-moduler).
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
  return createClient({ projectId, dataset, apiVersion, useCdn: true });
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

const arg = process.argv[2];

if (!arg || !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  console.error("Bruk: npm run sanity:heal-menu-horizon -- 2026-05-18");
  console.error("Argument må være mandag i ønsket uke (YYYY-MM-DD).");
  process.exit(1);
}

let mondayDate: string;
try {
  mondayDate = validateRolloutWeekMondayIso(arg);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(1);
}

console.log(`Heal: kjører menu-week-rollout for uke som starter ${mondayDate}`);
console.log("(Idempotent: skipper menuDay-docs som allerede finnes.)");
console.log("");

let sanityRead: SanityClient;
try {
  sanityRead = buildSanityRead();
  getSanityWrite();
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Klient-oppsett feilet:", msg);
  process.exit(1);
}

const result = await runMenuWeekRollout({
  supabaseAdmin: () => buildSupabaseAdmin(),
  sanityRead,
  getSanityWrite,
  overrideTargetWeekMonday: mondayDate,
});

console.log(JSON.stringify(result, null, 2));

if (result.errors.length > 0) {
  process.exit(1);
}
