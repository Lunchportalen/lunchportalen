/**
 * Localized fixed menu generator — provider preview presentation (read-only).
 * Behind LP_MENU_PROFILE_RESOLVER + LP_LOCALIZED_FIXED_MENU_GENERATOR.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import {
  isLocalizedFixedMenuGeneratorPanelEnabled,
} from "@/lib/menu-generator/featureFlag";
import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import { generateProviderWeekMenu } from "@/lib/menu-generator/generateProviderWeekMenu";
import { mapGeneratedWeekMenuToEmployeeSafe } from "@/lib/menu-generator/employeeSafeMapper";
import { mapGeneratedWeekMenuToProviderAdmin } from "@/lib/menu-generator/providerAdminMapper";
import { resolveProviderMenuRuntimeProfile } from "@/lib/menu-generator/resolveProviderMenuRuntimeProfile";
import { assessFixedDishBankStatus } from "@/lib/menu-generator/localizedFixedDishBanks";
import type { MenuProfileResolverResult } from "@/lib/menu-profile/types";
import type { ProviderSettingsMenuProfileRow } from "@/lib/providers/loadProviderSettingsMenuProfile";

export type ProviderMenuGeneratorPreviewTier = PlanTier;

export type ProviderMenuGeneratorPreviewPresentation =
  | { active: false }
  | {
      active: true;
      providerId: string;
      country: string;
      menuLocale: string;
      menuProfileId: string;
      currency: string;
      vatRate: number;
      enabledCategories: readonly string[];
      fixedDishBankStatus: ReturnType<typeof assessFixedDishBankStatus>;
      economySummary: {
        currency: string;
        vatRate: number;
        marginTarget: number;
      };
      fallbackWarning: string | null;
      weekStart: string;
      previewTiers: ProviderMenuGeneratorPreviewTier[];
      employeeSafePreview: ReturnType<typeof mapGeneratedWeekMenuToEmployeeSafe>;
      providerPreview: ReturnType<typeof mapGeneratedWeekMenuToProviderAdmin>;
    };

export function buildProviderMenuGeneratorPreviewPresentation(input: {
  providerId: string;
  settingsRow: ProviderSettingsMenuProfileRow | null;
  resolverResult: MenuProfileResolverResult | null | undefined;
  weekStart?: string;
  previewTier?: PlanTier;
  env?: EnvLike;
}): ProviderMenuGeneratorPreviewPresentation {
  if (!isLocalizedFixedMenuGeneratorPanelEnabled(input.env ?? {})) {
    return { active: false };
  }

  if (!input.settingsRow) return { active: false };

  const runtimeProfile = resolveProviderMenuRuntimeProfile({
    providerId: input.providerId,
    country: input.settingsRow.defaultCountryCode,
    menuLocale: input.settingsRow.locale,
    menuProfileId: input.settingsRow.menuProfileId,
    currency: input.settingsRow.defaultCurrency,
    resolverResult: input.resolverResult,
  });

  const weekStart = input.weekStart ?? startOfWeekISO(osloTodayISODate());
  const previewTier = input.previewTier ?? "LUXUS";

  const generated = generateProviderWeekMenu({
    providerId: input.providerId,
    weekStart,
    menuLocale: runtimeProfile.menuLocale,
    country: runtimeProfile.country,
    menuProfileId: runtimeProfile.menuProfileId,
    packageTier: previewTier,
    enabledCategories: runtimeProfile.enabledCategories,
    economyConfig: runtimeProfile.economyConfig,
  });

  const employeeSafePreview = mapGeneratedWeekMenuToEmployeeSafe(generated);
  const providerPreview = mapGeneratedWeekMenuToProviderAdmin(generated, runtimeProfile);

  return {
    active: true,
    providerId: input.providerId,
    country: runtimeProfile.country,
    menuLocale: runtimeProfile.menuLocale,
    menuProfileId: runtimeProfile.menuProfileId,
    currency: runtimeProfile.currency,
    vatRate: runtimeProfile.vatRate,
    enabledCategories: runtimeProfile.enabledCategories,
    fixedDishBankStatus: assessFixedDishBankStatus(runtimeProfile.menuLocale),
    economySummary: {
      currency: runtimeProfile.economyConfig.currency,
      vatRate: runtimeProfile.economyConfig.vatRate,
      marginTarget: runtimeProfile.economyConfig.marginTarget,
    },
    fallbackWarning: runtimeProfile.fallbackWarning,
    weekStart,
    previewTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    employeeSafePreview,
    providerPreview,
  };
}
