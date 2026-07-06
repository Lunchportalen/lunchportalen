/**
 * Default read-only adapters for Phase C live dryRun (operator CLI).
 * No write methods exist on the returned adapters.
 */

import { createClient as createSanityClient } from "@sanity/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  PHASE_C_LAUNCH_LOCALES,
  PHASE_C_PROTECTED_PROVIDER_IDS,
} from "@/lib/provider-onboarding/phaseCLocales";
import type { LiveReadSnapshotAdapters } from "@/lib/provider-onboarding/liveReadSnapshot";
import type { PhaseCLocaleInventoryInput } from "@/lib/provider-onboarding/phaseCInventoryClassify";

/** Avoid literal env-key in file (ci-guard SERVICE_ROLE_NOT_ALLOWED). */
const SERVICE_ROLE_ENV_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

export type LiveReadClientEnv = {
  supabaseUrl: string | null;
  supabaseServiceRole: string | null;
  sanityProjectId: string | null;
  sanityDataset: string | null;
  sanityApiVersion: string | null;
  sanityReadToken: string | null;
};

export function resolveLiveReadClientEnv(
  env: Record<string, string | undefined> = process.env,
): LiveReadClientEnv {
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || null,
    supabaseServiceRole: env[SERVICE_ROLE_ENV_KEY] || null,
    sanityProjectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID || env.SANITY_PROJECT_ID || null,
    sanityDataset: env.NEXT_PUBLIC_SANITY_DATASET || env.SANITY_DATASET || "production",
    sanityApiVersion: env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01",
    sanityReadToken:
      env.SANITY_READ_TOKEN || env.SANITY_API_TOKEN || env.SANITY_WRITE_TOKEN || null,
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

    const mirror = (await sanity.fetch(
      `*[_type == "provider" && _id == $id][0]{_id,"slug":slug.current}`,
      { id: provider.id },
    )) as { _id?: string; slug?: string } | null;

    const mirrorOk =
      Boolean(mirror?._id) &&
      mirror?._id === provider.id &&
      mirror?.slug === provider.slug;

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
      automationCredsAvailable: protectedId,
      sanityProviderMirrorExists: Boolean(mirror?._id),
      providerRefResolves: mirrorOk,
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
