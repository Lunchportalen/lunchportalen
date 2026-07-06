/**
 * Phase C onboarding live WRITE adapters — enabled only under scoped GO:
 * confirm=ONBOARD_PROVIDER_APPLY + PHASE_C_ALLOW_LIVE_ONBOARD=1.
 * Never prints passwords or tokens.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient as createSanityClient } from "@sanity/client";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  fetchSanityProviderMirrorSnapshot,
  validateProviderMirrorForGeneratorApply,
} from "@/lib/menu-generator/providerMirrorPreflight";
import type { LiveReadClientEnv } from "@/lib/provider-onboarding/createLiveReadAdapters";
import {
  PHASE_C_PROTECTED_PROVIDER_IDS,
  PHASE_C_PROTECTED_PROVIDER_SLUGS,
} from "@/lib/provider-onboarding/phaseCLocales";
import type { ProviderOnboardingExecuteAdapters } from "@/lib/provider-onboarding/providerOnboardingExecute";

function assertNotProtected(providerId: string, slug: string): void {
  const id = String(providerId ?? "").trim();
  const s = String(slug ?? "").trim().toLowerCase();
  if ((PHASE_C_PROTECTED_PROVIDER_IDS as readonly string[]).includes(id)) {
    throw new Error("PROTECTED_PROVIDER_MUTATION: refusing to mutate protected provider id.");
  }
  if ((PHASE_C_PROTECTED_PROVIDER_SLUGS as readonly string[]).includes(s)) {
    throw new Error("PROTECTED_PROVIDER_MUTATION: refusing to mutate protected provider slug.");
  }
}

function storeOperatorPasswordLocally(slug: string, email: string, password: string): string {
  const dir = path.resolve(process.cwd(), ".operator-local");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { mode: 0o700 });
  const file = path.join(dir, `${slug}-admin.credentials`);
  // Values never go to stdout/stderr. File is operator-local only (gitignored by convention).
  fs.writeFileSync(
    file,
    [
      `# Operator-local only. Never commit.`,
      `email=${email}`,
      `password=${password}`,
      `created_at=${new Date().toISOString()}`,
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 },
  );
  return file;
}

function resolvePassword(
  operatorEnv: Record<string, string | undefined>,
  adminEmail: string,
): string {
  // Locale-specific env first (DA_DK / SV_SE / …), never print values.
  const localeHints = [
    "DA_DK_PROVIDER_ADMIN_PASSWORD",
    "SV_SE_PROVIDER_ADMIN_PASSWORD",
    "NB_NO_PROVIDER_ADMIN_PASSWORD",
  ];
  for (const key of localeHints) {
    const v = operatorEnv[key];
    if (v && v.length >= 12) return v;
  }
  const generic = operatorEnv.PHASE_C_PROVIDER_ADMIN_PASSWORD;
  if (generic && generic.length >= 12) return generic;
  void adminEmail;
  return crypto.randomBytes(24).toString("base64url");
}

export function createLiveWriteAdapters(args: {
  cfg: LiveReadClientEnv;
  operatorEnv: Record<string, string | undefined>;
}): ProviderOnboardingExecuteAdapters {
  const { cfg, operatorEnv } = args;
  if (cfg.meta.supabaseEnvClass !== "production" || cfg.meta.sanityDataset !== "production") {
    throw new Error(
      "LIVE_WRITE_ENV_MISMATCH: live write adapters require production Supabase + production Sanity alignment.",
    );
  }
  if (!cfg.supabaseUrl || !cfg.supabaseServiceRole || !cfg.sanityProjectId || !cfg.sanityReadToken) {
    throw new Error("LIVE_WRITE_MISSING_ENV: required live-write env presence incomplete (values never printed).");
  }

  const writeToken =
    operatorEnv.SANITY_WRITE_TOKEN ||
    operatorEnv.SANITY_API_TOKEN ||
    operatorEnv.SANITY_READ_TOKEN ||
    null;
  if (!writeToken) {
    throw new Error("LIVE_WRITE_MISSING_ENV: Sanity write token missing (values never printed).");
  }

  const anonKey =
    operatorEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || operatorEnv.SUPABASE_ANON_KEY || null;
  const superEmail = operatorEnv.E2E_SUPERADMIN_EMAIL || operatorEnv.SUPERADMIN_EMAIL || null;
  const superPassword =
    operatorEnv.E2E_SUPERADMIN_PASSWORD || operatorEnv.SUPERADMIN_PASSWORD || null;
  if (!anonKey || !superEmail || !superPassword) {
    throw new Error(
      "LIVE_WRITE_MISSING_ENV: superadmin session credentials required for lp_provider_create (values never printed).",
    );
  }

  const admin = createSupabaseClient(cfg.supabaseUrl, cfg.supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sanityWrite = createSanityClient({
    projectId: cfg.sanityProjectId,
    dataset: cfg.meta.sanityDataset,
    apiVersion: cfg.sanityApiVersion || "2024-01-01",
    token: writeToken,
    useCdn: false,
  });

  return {
    async createProvider(input) {
      assertNotProtected("", input.slug);
      const anon = createSupabaseClient(cfg.supabaseUrl!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const login = await anon.auth.signInWithPassword({
        email: superEmail!,
        password: superPassword!,
      });
      if (login.error) throw new Error(`superadmin login: ${login.error.message}`);

      const rid = `phase-c-dadk-onboard-${Date.now()}`;
      const { data, error } = await anon.rpc("lp_provider_create", {
        p_slug: input.slug,
        p_name: input.name,
        p_contact_email: input.adminEmail,
        p_billing_model: "SAAS_FIXED",
        p_request_rid: rid,
      });
      if (error) throw new Error(`lp_provider_create: ${error.message}`);
      const providerId = String((data as { provider_id?: string } | null)?.provider_id ?? "").trim();
      if (!providerId) throw new Error("lp_provider_create returned empty provider_id");
      assertNotProtected(providerId, input.slug);
      await anon.auth.signOut();
      return { providerId };
    },

    async ensureOrganizationMirror(input) {
      assertNotProtected(input.providerId, input.slug);
      const { data: provRow, error: provErr } = await admin
        .from("providers")
        .select("id,name,slug,status,org_number,created_at,updated_at")
        .eq("id", input.providerId)
        .maybeSingle();
      if (provErr || !provRow) {
        throw new Error(`providers read for org mirror: ${provErr?.message ?? "missing"}`);
      }

      const now = new Date().toISOString();
      const { error } = await admin.from("organizations").upsert(
        {
          id: input.providerId,
          type: "provider",
          name: input.name,
          slug: input.slug,
          org_number: provRow.org_number ?? null,
          status: String(provRow.status ?? "ACTIVE"),
          legacy_source: "provider",
          legacy_provider_id: null,
          created_at: provRow.created_at ?? now,
          updated_at: provRow.updated_at ?? now,
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(`organizations upsert: ${error.message}`);
    },

    async upsertProviderSettings(input) {
      assertNotProtected(input.providerId, "");
      const now = new Date().toISOString();
      const { error } = await admin.from("provider_settings").upsert(
        {
          provider_id: input.providerId,
          locale: input.locale,
          menu_profile_id: input.menuProfileId,
          default_country_code: input.country,
          default_currency: input.currency,
          timezone: input.timezone,
          cutoff_time: "08:00",
          delivery_days: ["mon", "tue", "wed", "thu", "fri"],
          operations_email: input.adminEmail,
          kitchen_email: input.adminEmail,
          delivery_email: input.adminEmail,
          updated_at: now,
        },
        { onConflict: "provider_id" },
      );
      if (error) throw new Error(`provider_settings upsert: ${error.message}`);
    },

    async provisionProviderAdmin(input) {
      assertNotProtected(input.providerId, "");
      const password = resolvePassword(operatorEnv, input.adminEmail);
      const fileToken = String(input.adminEmail.split("@")[0] ?? "provider-admin")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-");
      storeOperatorPasswordLocally(fileToken, input.adminEmail, password);

      const created = await admin.auth.admin.createUser({
        email: input.adminEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role: "provider_admin",
          full_name: "Danish Lunch Pilot Admin",
          name: "Danish Lunch Pilot Admin",
        },
      });
      if (created.error) throw new Error(`createUser: ${created.error.message}`);
      const userId = created.data.user?.id ?? null;
      if (!userId) throw new Error("createUser returned empty user id");

      const now = new Date().toISOString();
      const { error: profileErr } = await admin.from("profiles").upsert(
        {
          id: userId,
          email: input.adminEmail,
          full_name: "Danish Lunch Pilot Admin",
          role: "provider_admin",
          company_id: null,
          location_id: null,
          is_active: true,
          active: true,
          updated_at: now,
        },
        { onConflict: "id" },
      );
      if (profileErr) throw new Error(`profiles upsert: ${profileErr.message}`);

      return { userId, passwordIssued: true };
    },

    async ensureProviderMembership(input) {
      assertNotProtected(input.providerId, "");
      const { error } = await admin.from("provider_memberships").upsert(
        {
          user_id: input.userId,
          provider_id: input.providerId,
          role: "provider_admin",
        },
        { onConflict: "user_id,provider_id" },
      );
      if (error) throw new Error(`provider_memberships upsert: ${error.message}`);
    },

    async syncProviderToSanity(providerId) {
      assertNotProtected(providerId, "");
      const { data, error } = await admin
        .from("providers")
        .select("id,name,slug,logo_url,primary_color,status")
        .eq("id", providerId)
        .maybeSingle();
      if (error || !data) {
        throw new Error(`syncProviderToSanity provider read: ${error?.message ?? "missing"}`);
      }
      const name = String(data.name ?? "").trim();
      const slug = String(data.slug ?? "").trim();
      if (!name || !slug) {
        throw new Error("syncProviderToSanity: provider missing name or slug");
      }
      assertNotProtected(providerId, slug);

      await sanityWrite.createOrReplace({
        _id: providerId,
        _type: "provider",
        name,
        slug: { _type: "slug", current: slug },
        logoUrl: data.logo_url != null ? String(data.logo_url) : undefined,
        primaryColor: data.primary_color != null ? String(data.primary_color) : undefined,
        status: String(data.status ?? "ACTIVE").toUpperCase(),
        lastSyncedAt: new Date().toISOString(),
      });
    },

    async verifySanityMirror(input) {
      assertNotProtected(input.providerId, input.expectedSlug);
      const mirror = await fetchSanityProviderMirrorSnapshot(
        (query, params) => sanityWrite.fetch(query, params),
        input.providerId,
      );
      const preflight = validateProviderMirrorForGeneratorApply({
        providerId: input.providerId,
        expectedSlug: input.expectedSlug,
        mirror,
        mode: "apply",
      });
      return {
        ok: preflight.ok,
        message: preflight.ok ? undefined : preflight.message,
      };
    },
  };
}

/** Load operator-local password file without printing contents. */
export function loadOperatorLocalPassword(slug: string): string | null {
  const file = path.resolve(process.cwd(), ".operator-local", `${slug}-admin.credentials`);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("password="));
  if (!line) return null;
  const password = line.slice("password=".length);
  return password || null;
}
