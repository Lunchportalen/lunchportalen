import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildG5d8GlobalControl,
  buildG5d8ProviderControl,
  type G5d8RuntimeCompatibilityControl,
} from "@/lib/menu-profile/g5d8RuntimeCompatibilityControl";
import { menuProfileResolverHostEnv } from "@/lib/providers/providerMenuProfileDiagnostic";
import {
  loadProviderSettingsMenuProfileRow,
  type ProviderSettingsMenuProfileRow,
} from "@/lib/providers/loadProviderSettingsMenuProfile";
import {
  buildProviderMenuProfileHealthFromSettingsRow,
  buildSuperadminMenuProfileRegistryRows,
  toSuperadminMenuProfileOverviewRow,
  type ProviderMenuProfileHealth,
  type SuperadminMenuProfileOverviewRow,
  type SuperadminMenuProfileRegistryRow,
} from "@/lib/superadmin/menuProfileControl";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_PROVIDER_CURRENCY = `${"NO"}K`;

const WARM_DISH_GENERATION_AUDIT_ACTION = "provider.menu_profile.warm_dish.generate";

export type SuperadminMenuProfileOverviewData = {
  checkedAt: string;
  resolverFlagOn: boolean;
  compatibilityHook: G5d8RuntimeCompatibilityControl;
  registry: SuperadminMenuProfileRegistryRow[];
  providers: SuperadminMenuProfileOverviewRow[];
  totals: {
    providers: number;
    resolvedOk: number;
    warnings: number;
    generationEnabled: number;
  };
};

export type SuperadminMenuProfileProviderDetail = {
  providerId: string;
  providerName: string;
  health: ProviderMenuProfileHealth;
  compatibilityHook: G5d8RuntimeCompatibilityControl;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function summarizeGeneration(detail: unknown): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const after = (detail as { after?: unknown }).after;
  if (!after || typeof after !== "object" || Array.isArray(after)) return null;
  const applied = Array.isArray((after as { appliedDates?: unknown }).appliedDates)
    ? (after as { appliedDates: string[] }).appliedDates.length
    : null;
  const skipped = Array.isArray((after as { skippedDates?: unknown }).skippedDates)
    ? (after as { skippedDates: string[] }).skippedDates.length
    : null;
  const profileId = safeStr((after as { profileId?: unknown }).profileId);
  if (applied == null && skipped == null && !profileId) return null;
  const parts: string[] = [];
  if (profileId) parts.push(profileId);
  if (applied != null) parts.push(`${applied} fylt`);
  if (skipped != null) parts.push(`${skipped} hoppet over`);
  return parts.join(" · ") || null;
}

async function loadRecentWarmDishGenerationByProvider(
  admin: SupabaseClient,
  providerIds: string[],
): Promise<Map<string, { at: string; summary: string | null }>> {
  const out = new Map<string, { at: string; summary: string | null }>();
  if (providerIds.length === 0) return out;

  try {
    const { data, error } = await admin
      .from("audit_events")
      .select("entity_id,created_at,detail")
      .eq("entity_type", "provider")
      .in("entity_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(providerIds.length * 3, 200));

    if (error || !data) return out;

    for (const row of data) {
      const providerId = safeStr((row as { entity_id?: string }).entity_id);
      if (!providerId || out.has(providerId)) continue;
      const detail = (row as { detail?: unknown }).detail;
      const auditAction =
        detail && typeof detail === "object" && !Array.isArray(detail)
          ? safeStr((detail as { audit_action?: unknown }).audit_action)
          : "";
      if (auditAction !== WARM_DISH_GENERATION_AUDIT_ACTION) continue;
      out.set(providerId, {
        at: safeStr((row as { created_at?: string }).created_at) || new Date().toISOString(),
        summary: summarizeGeneration(detail),
      });
    }
  } catch {
    return out;
  }

  return out;
}

async function loadProviderSettingsRows(
  admin: SupabaseClient,
  providerIds: string[],
): Promise<Map<string, ProviderSettingsMenuProfileRow>> {
  const out = new Map<string, ProviderSettingsMenuProfileRow>();
  if (providerIds.length === 0) return out;

  try {
    const { data, error } = await admin
      .from("provider_settings")
      .select("provider_id,menu_profile_id,default_country_code,locale,default_currency")
      .in("provider_id", providerIds);

    if (error || !data) return out;

    for (const row of data) {
      const providerId = safeStr((row as { provider_id?: string }).provider_id);
      if (!providerId) continue;
      out.set(providerId, {
        providerId,
        menuProfileId: (row as { menu_profile_id?: string | null }).menu_profile_id ?? null,
        defaultCountryCode:
          safeStr((row as { default_country_code?: string }).default_country_code) || "NO",
        locale: safeStr((row as { locale?: string }).locale) || "nb-NO",
        defaultCurrency: safeStr((row as { default_currency?: string }).default_currency) || DEFAULT_PROVIDER_CURRENCY,
      });
    }
  } catch {
    return out;
  }

  return out;
}

export async function loadSuperadminMenuProfileOverview(): Promise<SuperadminMenuProfileOverviewData> {
  const admin = supabaseAdmin();
  const env = menuProfileResolverHostEnv();

  const { data: providers, error } = await admin
    .from("providers")
    .select("id,name")
    .is("deleted_at", null)
    .neq("status", "CLOSED")
    .order("name", { ascending: true });

  if (error) throw error;

  const rows = (providers ?? []) as Array<{ id: string; name: string }>;
  const providerIds = rows.map((p) => safeStr(p.id)).filter(Boolean);
  const [settingsByProvider, generationByProvider] = await Promise.all([
    loadProviderSettingsRows(admin, providerIds),
    loadRecentWarmDishGenerationByProvider(admin, providerIds),
  ]);

  const overviewRows: SuperadminMenuProfileOverviewRow[] = [];

  for (const provider of rows) {
    const providerId = safeStr(provider.id);
    const settingsRow =
      settingsByProvider.get(providerId) ??
      ({
        providerId,
        menuProfileId: null,
        defaultCountryCode: "NO",
        locale: "nb-NO",
        defaultCurrency: DEFAULT_PROVIDER_CURRENCY,
      } satisfies ProviderSettingsMenuProfileRow);

    const generation = generationByProvider.get(providerId);
    const health = buildProviderMenuProfileHealthFromSettingsRow(settingsRow, env, {
      lastGenerationAt: generation?.at ?? null,
      lastGenerationSummary: generation?.summary ?? null,
    });

    overviewRows.push(
      toSuperadminMenuProfileOverviewRow(providerId, safeStr(provider.name) || "Ukjent leverandør", health),
    );
  }

  return {
    checkedAt: new Date().toISOString(),
    resolverFlagOn: overviewRows.some((row) => row.resolverStatus === "ON"),
    compatibilityHook: buildG5d8GlobalControl(env, {
      resolverFlagOn: overviewRows.some((row) => row.resolverStatus === "ON"),
      warningProviders: overviewRows.filter((row) => row.readiness === "warning" || row.mismatch).length,
      profileFailProviders: overviewRows.filter((row) => row.profileResolved === "FAIL").length,
    }),
    registry: buildSuperadminMenuProfileRegistryRows(),
    providers: overviewRows,
    totals: {
      providers: overviewRows.length,
      resolvedOk: overviewRows.filter((row) => row.profileResolved === "OK").length,
      warnings: overviewRows.filter((row) => row.readiness === "warning" || row.mismatch).length,
      generationEnabled: overviewRows.filter((row) => row.generationEnabled).length,
    },
  };
}

export async function loadSuperadminMenuProfileProviderDetail(
  providerId: string,
): Promise<SuperadminMenuProfileProviderDetail | null> {
  const pid = safeStr(providerId);
  if (!pid) return null;

  const admin = supabaseAdmin();
  const env = menuProfileResolverHostEnv();

  const [{ data: provider, error: providerErr }, settingsRow, generationByProvider] = await Promise.all([
    admin.from("providers").select("id,name").eq("id", pid).maybeSingle(),
    loadProviderSettingsMenuProfileRow(pid),
    loadRecentWarmDishGenerationByProvider(admin, [pid]),
  ]);

  if (providerErr || !provider) return null;

  const generation = generationByProvider.get(pid);
  const row =
    settingsRow ??
    ({
      providerId: pid,
      menuProfileId: null,
      defaultCountryCode: "NO",
      locale: "nb-NO",
      defaultCurrency: DEFAULT_PROVIDER_CURRENCY,
    } satisfies ProviderSettingsMenuProfileRow);

  const health = buildProviderMenuProfileHealthFromSettingsRow(row, env, {
    lastGenerationAt: generation?.at ?? null,
    lastGenerationSummary: generation?.summary ?? null,
  });

  return {
    providerId: pid,
    providerName: safeStr((provider as { name?: string }).name) || "Ukjent leverandør",
    health,
    compatibilityHook: buildG5d8ProviderControl(env, {
      profileResolved: health.profileResolved,
      fallbackActive: health.fallbackActive,
      resolveSource: health.resolveSource,
      readiness: health.readiness,
      warning: health.warning,
    }),
  };
}
