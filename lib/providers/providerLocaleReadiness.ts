// lib/providers/providerLocaleReadiness.ts
// Read-only locale readiness audit — no runtime DB dependency.

import { DEFAULT_PROVIDER_LOCALE, PROVIDER_LOCALE_OPTIONS } from "@/lib/providers/operationalSettingsShared";

export type LocaleReadinessRow = {
  scope: string;
  fieldExists: boolean;
  proposedField: string;
  usage: string;
  storableNow: boolean;
};

/**
 * Documented locale model for provider/customer surfaces.
 * Storable today: provider_settings.locale (provider UI) and profiles.preferred_locale (app UI).
 */
export const PROVIDER_LOCALE_READINESS: readonly LocaleReadinessRow[] = [
  {
    scope: "Provider",
    fieldExists: true,
    proposedField: "provider_settings.locale",
    usage: "Default språk for leverandørflate (dato/tid-formattering i provider UI)",
    storableNow: true,
  },
  {
    scope: "Customer/company",
    fieldExists: false,
    proposedField: "companies.preferred_locale",
    usage: "Språk for kundebedrift og kunde-e-poster",
    storableNow: false,
  },
  {
    scope: "User/profile",
    fieldExists: true,
    proposedField: "profiles.preferred_locale",
    usage: "Personlig UI-språk (overstyrer company default)",
    storableNow: true,
  },
  {
    scope: "Invoice",
    fieldExists: false,
    proposedField: "companies.invoice_locale",
    usage: "Faktura- og EHF/e-postspråk",
    storableNow: false,
  },
  {
    scope: "Emails",
    fieldExists: false,
    proposedField: "template.locale",
    usage: "Malvalg per språk i transaksjonelle e-poster",
    storableNow: false,
  },
] as const;

export function providerLocaleStorableScopes(): LocaleReadinessRow[] {
  return PROVIDER_LOCALE_READINESS.filter((row) => row.storableNow);
}

export function providerLocaleHasCompanyStorage(): boolean {
  return PROVIDER_LOCALE_READINESS.some((row) => row.scope === "Customer/company" && row.fieldExists);
}

export { DEFAULT_PROVIDER_LOCALE, PROVIDER_LOCALE_OPTIONS };
