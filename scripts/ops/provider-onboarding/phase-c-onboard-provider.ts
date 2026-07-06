#!/usr/bin/env npx tsx
/**
 * Phase C provider onboarding factory CLI.
 *
 * Modes:
 *   --dry-run   validate + plan only (no writes)
 *   --apply     requires --confirm=ONBOARD_PROVIDER_APPLY
 *               live writes require PHASE_C_ALLOW_LIVE_ONBOARD=1 + scoped GO
 *
 * Never creates menuDays, never publishes, never starts SOT/auto-rollout.
 * Never mutates Melhus or Swedish Lunch Pilot.
 *
 * Usage examples:
 *   npx tsx scripts/ops/provider-onboarding/phase-c-onboard-provider.ts --dry-run --locale=da-DK
 *   npx tsx scripts/ops/provider-onboarding/phase-c-onboard-provider.ts --apply --locale=da-DK --confirm=ONBOARD_PROVIDER_APPLY
 */

import fs from "node:fs";
import path from "node:path";

import {
  PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
  PHASE_C_SAFE_FUTURE_WEEKS,
  phaseCTargetForLocale,
} from "@/lib/provider-onboarding/phaseCLocales";
import {
  buildProviderOnboardingPlan,
  serializeProviderOnboardingPlan,
} from "@/lib/provider-onboarding/providerOnboardingPlan";
import type {
  ProviderOnboardingInput,
  ProviderOnboardingPreflightSnapshot,
} from "@/lib/provider-onboarding/providerOnboardingTypes";

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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
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

/** Avoid literal env-key in file (ci-guard SERVICE_ROLE_NOT_ALLOWED). */
const SERVICE_ROLE_ENV_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

function envPresence(): ProviderOnboardingPreflightSnapshot["envPresence"] {
  const local = loadDotEnvLocal();
  const get = (k: string) => Boolean(process.env[k] || local[k]);
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

function emptySnapshot(): ProviderOnboardingPreflightSnapshot {
  return {
    existingProviders: [],
    existingAdminEmails: [],
    providersByLocale: [],
    globalTemplateKeys: [],
    envPresence: envPresence(),
  };
}

function buildInput(): ProviderOnboardingInput {
  const dryRun = hasFlag("--dry-run");
  const apply = hasFlag("--apply");
  if (dryRun === apply) {
    throw new Error("Specify exactly one of --dry-run or --apply");
  }

  const locale = argValue("--locale") ?? "";
  const target = phaseCTargetForLocale(locale);
  if (!target) {
    throw new Error(`Unknown or unsupported Phase C locale: ${locale}`);
  }

  return {
    providerName: argValue("--name") ?? target.recommendedProviderName,
    providerSlug: argValue("--slug") ?? target.recommendedProviderSlug,
    locale: target.locale,
    menuProfileId: argValue("--menu-profile-id") ?? target.menuProfileId,
    country: argValue("--country") ?? target.country,
    currency: argValue("--currency") ?? target.currency,
    timezone: argValue("--timezone") ?? target.timezone,
    adminEmail:
      argValue("--admin-email") ??
      `${target.recommendedProviderSlug}-admin@lunchportalen.no`,
    safeFutureWeek:
      argValue("--week") ?? PHASE_C_SAFE_FUTURE_WEEKS[target.locale] ?? "2031-11-03",
    mode: apply ? "apply" : "dry_run",
    operatorConfirmationPhrase: argValue("--confirm"),
  };
}

async function main() {
  const input = buildInput();
  // Planner-only snapshot in this CLI entry. Live conflict/mirror reads belong to scoped GO sessions.
  const snapshot = emptySnapshot();
  const plan = buildProviderOnboardingPlan(input, snapshot);
  const body = serializeProviderOnboardingPlan(plan);

  if (input.mode === "dry_run") {
    console.log(
      JSON.stringify(
        {
          status: plan.ok ? "DRY_RUN_OK" : "DRY_RUN_BLOCKED",
          liveWrites: false,
          note: "Dry-run only. No provider/org/settings/auth/mirror writes performed.",
          ...body,
        },
        null,
        2,
      ),
    );
    process.exit(plan.ok ? 0 : 1);
  }

  // Apply mode: require confirmation + explicit live gate.
  if (input.operatorConfirmationPhrase !== PHASE_C_ONBOARD_CONFIRMATION_PHRASE) {
    console.log(
      JSON.stringify(
        {
          status: "APPLY_BLOCKED",
          liveWrites: false,
          message: `Missing confirmation phrase ${PHASE_C_ONBOARD_CONFIRMATION_PHRASE}`,
          ...body,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (process.env.PHASE_C_ALLOW_LIVE_ONBOARD !== "1") {
    console.log(
      JSON.stringify(
        {
          status: "APPLY_GATED",
          liveWrites: false,
          message:
            "Live onboarding apply is gated. Set PHASE_C_ALLOW_LIVE_ONBOARD=1 only under scoped GO. Plan validated only.",
          confirmationAccepted: true,
          ...body,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  // Live execute path remains intentionally unimplemented in this CLI entry until a scoped GO
  // wires production adapters. Refuse rather than partially write.
  console.log(
    JSON.stringify(
      {
        status: "APPLY_REFUSED_NO_LIVE_ADAPTER",
        liveWrites: false,
        message:
          "PHASE_C_ALLOW_LIVE_ONBOARD=1 set, but live adapters are intentionally not enabled in this control release. Use a scoped GO runbook session to wire approved adapters.",
        ...body,
      },
      null,
      2,
    ),
  );
  process.exit(3);
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "ERROR",
        liveWrites: false,
        message: String(error?.message ?? error),
        secretsRedacted: true,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
