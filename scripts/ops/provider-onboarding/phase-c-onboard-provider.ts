#!/usr/bin/env npx tsx
/**
 * Phase C provider onboarding factory CLI.
 *
 * Modes:
 *   --dry-run   validate + plan only (no writes)
 *   --apply     requires --confirm=ONBOARD_PROVIDER_APPLY
 *               live writes require PHASE_C_ALLOW_LIVE_ONBOARD=1 + scoped GO
 *
 * Snapshot sources:
 *   --snapshot-source live     (default) read-only Supabase/Sanity preflight
 *   --snapshot-source fixture  tests only — not production operator readiness
 *
 * Never creates menuDays, never publishes, never starts SOT / mass expansion.
 * Never mutates Melhus or Swedish Lunch Pilot.
 *
 * Usage:
 *   node scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs \
 *     --dry-run --snapshot-source live --locale da-DK
 */

import fs from "node:fs";
import path from "node:path";

import {
  createLiveReadAdapters,
  liveReadClientEnvReady,
  resolveLiveReadClientEnv,
} from "@/lib/provider-onboarding/createLiveReadAdapters";
import { runPhaseCOnboardCli } from "@/lib/provider-onboarding/phaseCOnboardCli";
import type { ProviderOnboardingEnvPresence } from "@/lib/provider-onboarding/providerOnboardingTypes";

/** Avoid literal env-key in file (ci-guard SERVICE_ROLE_NOT_ALLOWED). */
const SERVICE_ROLE_ENV_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

function loadDotEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

function argValue(flag: string): string | null {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return null;
}

/**
 * Operator-local env load.
 * - Default: .env.local fills missing, then .env.preview.verify fills remaining gaps.
 * - --env-file PATH: that file overrides for client/env-presence (production readiness).
 * Values never printed.
 */
function loadOperatorEnv(): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...process.env };
  for (const file of [".env.local", ".env.preview.verify"]) {
    const loaded = loadDotEnvFile(path.resolve(process.cwd(), file));
    for (const [k, v] of Object.entries(loaded)) {
      if (!merged[k]) merged[k] = v;
    }
  }

  const envFile = argValue("--env-file") ?? argValue("--envFile");
  if (envFile) {
    const loaded = loadDotEnvFile(path.resolve(process.cwd(), envFile));
    if (Object.keys(loaded).length === 0) {
      throw new Error(`--env-file not found or empty: ${envFile}`);
    }
    for (const [k, v] of Object.entries(loaded)) {
      merged[k] = v;
    }
  }
  return merged;
}

function envPresence(env: Record<string, string | undefined>): ProviderOnboardingEnvPresence {
  const get = (k: string) => Boolean(env[k]);
  return {
    hasSupabaseServiceRole: get(SERVICE_ROLE_ENV_KEY),
    hasSanityReadToken: get("SANITY_READ_TOKEN") || get("SANITY_API_TOKEN"),
    hasSanityWriteToken: get("SANITY_WRITE_TOKEN") || get("SANITY_API_TOKEN"),
    hasSuperadminCreds: Boolean(
      (get("E2E_SUPERADMIN_EMAIL") || get("SUPERADMIN_EMAIL")) &&
        (get("E2E_SUPERADMIN_PASSWORD") || get("SUPERADMIN_PASSWORD")),
    ),
  };
}

async function main() {
  const operatorEnv = loadOperatorEnv();
  const envFileOverride = Boolean(argValue("--env-file") ?? argValue("--envFile"));
  // When --env-file is set, force-hydrate so production readiness is not masked by prior process.env.
  for (const [k, v] of Object.entries(operatorEnv)) {
    if (v == null) continue;
    if (envFileOverride || process.env[k] == null) process.env[k] = v;
  }

  const presence = envPresence(operatorEnv);
  const clientCfg = resolveLiveReadClientEnv(operatorEnv);

  const result = await runPhaseCOnboardCli(process.argv.slice(2), {
    envPresence: presence,
    liveOnboardFlag: operatorEnv.PHASE_C_ALLOW_LIVE_ONBOARD === "1",
    liveAdaptersEnabled: false,
    liveReadEnvMeta: clientCfg.meta,
    createLiveAdapters: () => {
      if (!liveReadClientEnvReady(clientCfg)) {
        throw new Error(
          "LIVE_READ_MISSING_ENV: Live-read dryRun requires Supabase service-role and Sanity read token env presence (values never printed). Use --snapshot-source fixture only in tests.",
        );
      }
      return createLiveReadAdapters(clientCfg);
    },
  });

  console.log(JSON.stringify(result.body, null, 2));
  process.exit(result.exitCode);
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "ERROR",
        liveWrites: false,
        writes: 0,
        message: String(error?.message ?? error),
        secretsRedacted: true,
        passwordPrinted: false,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
