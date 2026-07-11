// GLOBAL RELEASE GATE (Fase E5): recipient locale for transactional email.
// Chain (no cookie in email context): profiles.preferred_locale →
// companies.preferred_locale → market default (billing_country) → nb.
import "server-only";

import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";
import type { AppLocale } from "@/lib/i18n/middlewareLocale";

type AdminClientLike = {
  from: (table: string) => any;
};

/** Resolve by known user id (existing users, e.g. password reset). */
export async function resolveRecipientLocaleForUser(
  admin: AdminClientLike,
  userId: string,
): Promise<AppLocale> {
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("preferred_locale, company_id")
      .eq("id", userId)
      .maybeSingle();
    return resolveWithCompany(admin, profile?.preferred_locale ?? null, profile?.company_id ?? null);
  } catch {
    return resolveAppLocale({});
  }
}

/** Resolve for invitees who have no profile yet: use the inviting company. */
export async function resolveRecipientLocaleForCompany(
  admin: AdminClientLike,
  companyId: string | null | undefined,
): Promise<AppLocale> {
  return resolveWithCompany(admin, null, companyId ?? null);
}

async function resolveWithCompany(
  admin: AdminClientLike,
  profileLocale: string | null,
  companyId: string | null,
): Promise<AppLocale> {
  try {
    if (!companyId) return resolveAppLocale({ profile: profileLocale });
    const { data: company } = await admin
      .from("companies")
      .select("preferred_locale, billing_country")
      .eq("id", companyId)
      .maybeSingle();
    return resolveAppLocale({
      profile: profileLocale,
      company: company?.preferred_locale ?? null,
      marketCountry: company?.billing_country ?? null,
    });
  } catch {
    return resolveAppLocale({ profile: profileLocale });
  }
}
