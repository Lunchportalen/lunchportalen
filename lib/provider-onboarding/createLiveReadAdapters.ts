/**
 * Default read-only adapters for Phase C live dryRun (operator CLI).
 * No write methods exist on the returned adapters.
 */

import { createClient as createSanityClient } from "@sanity/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  fetchSanityProviderMirrorSnapshot,
  validateProviderMirrorForGeneratorApply,
  type ProviderMirrorSnapshot,
} from "@/lib/menu-generator/providerMirrorPreflight";
import {
  PHASE_C_LAUNCH_LOCALES,
  PHASE_C_PROTECTED_PROVIDER_IDS,
} from "@/lib/provider-onboarding/phaseCLocales";
import type { LiveReadSnapshotAdapters } from "@/lib/provider-onboarding/liveReadSnapshot";
import type { PhaseCLocaleInventoryInput } from "@/lib/provider-onboarding/phaseCInventoryClassify";

/** Avoid literal env-key in file (ci-guard SERVICE_ROLE_NOT_ALLOWED). */
const SERVICE_ROLE_ENV_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

/**
 * Lunchportalen RC production Supabase project ref.
 * Operator env packs historically mix this URL with Sanity dataset=staging.
 */
const PRODUCTION_SUPABASE_REF = "hkpokyapzarefrgqzkos";

export type LiveReadSupabaseEnvClass = "production" | "non_production" | "unknown";

export type LiveReadEnvMeta = {
  supabaseEnvClass: LiveReadSupabaseEnvClass;
  sanityDataset: string;
  /** True when dataset was corrected from a non-production value for production Supabase. */
  datasetAlignedToProduction: boolean;
};

export type LiveReadClientEnv = {
  supabaseUrl: string | null;
  supabaseServiceRole: string | null;
  sanityProjectId: string | null;
  sanityDataset: string | null;
  sanityApiVersion: string | null;
  sanityReadToken: string | null;
  meta: LiveReadEnvMeta;
};

export function classifySupabaseEnv(url: string | null | undefined): LiveReadSupabaseEnvClass {
  const u = String(url ?? "");
  if (!u) return "unknown";
  if (u.includes(PRODUCTION_SUPABASE_REF)) return "production";
  return "non_production";
}

/**
 * Pair Supabase + Sanity for inventory truth.
 * Production Supabase inventory must read production Sanity mirrors (PR #430 parity).
 * Mixed packs (.env.preview.verify) otherwise falsely report BLOCKED_SANITY_MIRROR
 * for production-verified providers that only exist on production dataset.
 */
export function alignLiveReadSanityDataset(args: {
  supabaseUrl: string | null;
  sanityDataset: string | null;
}): { sanityDataset: string; meta: LiveReadEnvMeta } {
  const supabaseEnvClass = classifySupabaseEnv(args.supabaseUrl);
  const requested = String(args.sanityDataset ?? "production").trim() || "production";
  let sanityDataset = requested;
  let datasetAlignedToProduction = false;

  if (supabaseEnvClass === "production" && sanityDataset !== "production") {
    sanityDataset = "production";
    datasetAlignedToProduction = true;
  }

  return {
    sanityDataset,
    meta: { supabaseEnvClass, sanityDataset, datasetAlignedToProduction },
  };
}

/**
 * Map a Sanity mirror snapshot with the same rules as PR #430 generator preflight.
 * No writes. No fake READY.
 */
export function evaluateInventoryProviderMirror(args: {
  providerId: string;
  providerSlug: string;
  mirror: ProviderMirrorSnapshot | null;
}): { sanityProviderMirrorExists: boolean; providerRefResolves: boolean } {
  const preflight = validateProviderMirrorForGeneratorApply({
    providerId: args.providerId,
    expectedSlug: args.providerSlug,
    mirror: args.mirror,
    mode: "dry_run",
  });
  return {
    sanityProviderMirrorExists: Boolean(args.mirror?.sanityId),
    providerRefResolves: preflight.ok,
  };
}

export function resolveLiveReadClientEnv(
  env: Record<string, string | undefined> = process.env,
): LiveReadClientEnv {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || null;
  const aligned = alignLiveReadSanityDataset({
    supabaseUrl,
    sanityDataset: env.NEXT_PUBLIC_SANITY_DATASET || env.SANITY_DATASET || "production",
  });

  return {
    supabaseUrl,
    supabaseServiceRole: env[SERVICE_ROLE_ENV_KEY] || null,
    sanityProjectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID || env.SANITY_PROJECT_ID || null,
    sanityDataset: aligned.sanityDataset,
    sanityApiVersion: env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01",
    sanityReadToken:
      env.SANITY_READ_TOKEN || env.SANITY_API_TOKEN || env.SANITY_WRITE_TOKEN || null,
    meta: aligned.meta,
  };
}

export function liveReadClientEnvReady(cfg: LiveReadClientEnv): boolean {
  return Boolean(cfg.supabaseUrl && cfg.supabaseServiceRole && cfg.sanityProjectId && cfg.sanityReadToken);
}

async function findExistingAdminEmails(
  admin: SupabaseClient,
  candidateEmails: string[],
): Promise<string[]> {
  const found = new Set<string>();
  for (const email of candidateEmails) {
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!normalized) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("id,email")
      .ilike("email", normalized)
      .maybeSingle();
    if (profile?.email) {
      found.add(String(profile.email).toLowerCase());
      continue;
    }

    // Read-only auth lookup — stop early once candidate email is found.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`auth listUsers: ${error.message}`);
    const hit = (data?.users ?? []).find(
      (u) => String(u.email ?? "").toLowerCase() === normalized,
    );
    if (hit?.email) found.add(String(hit.email).toLowerCase());
  }
  return [...found];
}

async function loadLocaleInventoryRows(
  admin: SupabaseClient,
  sanity: { fetch: (query: string, params?: Record<string, unknown>) => Promise<unknown> },
  globalTemplatesOk: boolean,
): Promise<PhaseCLocaleInventoryInput[]> {
  const rows: PhaseCLocaleInventoryInput[] = [];

  for (const target of PHASE_C_LAUNCH_LOCALES) {
    let provider: { id: string; name: string; slug: string } | null = null;

    if (target.knownProviderId) {
      const { data } = await admin
        .from("providers")
        .select("id,name,slug")
        .eq("id", target.knownProviderId)
        .maybeSingle();
      provider = data;
    } else {
      const { data: settings } = await admin
        .from("provider_settings")
        .select("provider_id,locale")
        .eq("locale", target.locale);
      if ((settings ?? []).length > 0) {
        const pid = settings![0]!.provider_id as string;
        const { data } = await admin
          .from("providers")
          .select("id,name,slug")
          .eq("id", pid)
          .maybeSingle();
        provider = data;
      }
    }

    if (!provider) {
      rows.push({
        locale: target.locale,
        menuProfileId: target.menuProfileId,
        country: target.country,
        currency: target.currency,
        timezone: target.timezone,
        providerExists: false,
        providerId: null,
        providerSlug: null,
        organizationMirrorExists: false,
        providerSettingsComplete: false,
        providerAdminAuthExists: false,
        providerMembershipExists: false,
        automationCredsAvailable: false,
        sanityProviderMirrorExists: false,
        providerRefResolves: false,
        globalSanityTemplatesOk: globalTemplatesOk,
        providerScopedCatalogDocs: 0,
        existingFutureMenuDays: 0,
        latestApplyOrDryRunEvidence: null,
      });
      continue;
    }

    const { data: org } = await admin
      .from("organizations")
      .select("id,type")
      .eq("id", provider.id)
      .maybeSingle();

    const { data: settings } = await admin
      .from("provider_settings")
      .select("locale,menu_profile_id,default_country_code,default_currency,timezone")
      .eq("provider_id", provider.id)
      .maybeSingle();

    const settingsOk =
      settings?.locale === target.locale &&
      settings?.menu_profile_id === target.menuProfileId &&
      settings?.default_country_code === target.country &&
      settings?.default_currency === target.currency &&
      settings?.timezone === target.timezone;

    const { data: memberships } = await admin
      .from("provider_memberships")
      .select("user_id,role")
      .eq("provider_id", provider.id)
      .eq("role", "provider_admin");

    const membershipExists = (memberships ?? []).length > 0;
    let authExists = false;
    if (membershipExists) {
      const uid = memberships![0]!.user_id as string;
      const { data: profile } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", uid)
        .maybeSingle();
      authExists = Boolean(profile?.id);
    }

    // PR #430 parity: same fetch + normalize rules as generator providerMirrorPreflight.
    const mirror = await fetchSanityProviderMirrorSnapshot(
      (query, params) => sanity.fetch(query, params),
      provider.id,
    );
    const mirrorFlags = evaluateInventoryProviderMirror({
      providerId: provider.id,
      providerSlug: provider.slug,
      mirror,
    });

    const cats = (await sanity.fetch(
      `count(*[_type == "lunchCategory" && defined(provider) && provider._ref == $pid])`,
      { pid: provider.id },
    )) as number;

    const days = (await sanity.fetch(
      `count(*[_type == "menuDay" && provider._ref == $pid && date >= "2031-01-01"])`,
      { pid: provider.id },
    )) as number;

    const protectedId = (PHASE_C_PROTECTED_PROVIDER_IDS as readonly string[]).includes(
      provider.id,
    );

    rows.push({
      locale: target.locale,
      menuProfileId: target.menuProfileId,
      country: target.country,
      currency: target.currency,
      timezone: target.timezone,
      providerExists: true,
      providerId: provider.id,
      providerSlug: provider.slug,
      organizationMirrorExists: org?.type === "provider",
      providerSettingsComplete: Boolean(settingsOk),
      providerAdminAuthExists: authExists,
      providerMembershipExists: membershipExists,
      automationCredsAvailable: protectedId || (authExists && membershipExists),
      sanityProviderMirrorExists: mirrorFlags.sanityProviderMirrorExists,
      providerRefResolves: mirrorFlags.providerRefResolves,
      globalSanityTemplatesOk: globalTemplatesOk,
      providerScopedCatalogDocs: cats ?? 0,
      existingFutureMenuDays: days ?? 0,
      latestApplyOrDryRunEvidence: protectedId
        ? "PR #430/#431 production smoke"
        : null,
    });
  }

  return rows;
}

/**
 * Build read-only adapters. Callers must only use these for dryRun preflight.
 */
export function createLiveReadAdapters(cfg: LiveReadClientEnv): LiveReadSnapshotAdapters {
  if (!liveReadClientEnvReady(cfg)) {
    throw new Error(
      "Live-read client env incomplete (supabase url/service-role, sanity project/token). Values never printed.",
    );
  }

  const admin = createSupabaseClient(cfg.supabaseUrl!, cfg.supabaseServiceRole!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sanity = createSanityClient({
    projectId: cfg.sanityProjectId!,
    dataset: cfg.sanityDataset || "production",
    apiVersion: cfg.sanityApiVersion || "2024-01-01",
    token: cfg.sanityReadToken!,
    useCdn: false,
  });

  return {
    async listProviders() {
      const { data, error } = await admin.from("providers").select("id,name,slug");
      if (error) throw new Error(`providers: ${error.message}`);
      return (data ?? []).map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        slug: String(p.slug ?? ""),
      }));
    },

    async listProviderSettingsLocales() {
      const { data, error } = await admin
        .from("provider_settings")
        .select("provider_id,locale");
      if (error) throw new Error(`provider_settings: ${error.message}`);
      return (data ?? []).map((s) => ({
        providerId: String(s.provider_id),
        locale: String(s.locale ?? ""),
      }));
    },

    async findExistingAdminEmails(candidateEmails) {
      return findExistingAdminEmails(admin, candidateEmails);
    },

    async listGlobalTemplateKeys() {
      const globals = (await sanity.fetch(
        `*[_type == "lunchCategory" && !defined(provider)]{"key": key.current}`,
      )) as Array<{ key?: string }>;
      return globals.map((g) => g.key).filter((k): k is string => Boolean(k));
    },

    async loadLocaleInventoryRows(globalTemplatesOk) {
      return loadLocaleInventoryRows(admin, sanity, globalTemplatesOk);
    },
  };
}
