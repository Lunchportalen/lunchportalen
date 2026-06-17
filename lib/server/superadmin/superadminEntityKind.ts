import "server-only";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/** Canonical lunch customer companies that are platform/system — not Superadmin main rows. */
const SYSTEM_PLATFORM_COMPANY_NAME_PATTERNS = [
  /^lunchportalen$/i,
  /^lunchportalen\s+as$/i,
  /^lunchportalen\s+qa$/i,
];

export type OrganizationMetadata = {
  transitory?: boolean | string;
  phase4_pension?: string;
  legacy_company_name?: string;
};

export function isSystemPlatformCompanyName(name: string | null | undefined): boolean {
  const n = safeStr(name);
  if (!n) return false;
  return SYSTEM_PLATFORM_COMPANY_NAME_PATTERNS.some((pattern) => pattern.test(n));
}

export function isSystemPlatformOrganization(input: {
  name?: string | null;
  metadata?: OrganizationMetadata | null;
  legacy_source?: string | null;
}): boolean {
  const meta = input.metadata ?? null;
  if (meta?.transitory === true || meta?.transitory === "true") {
    if (safeStr(meta.phase4_pension) === "platform_internal_customer") return true;
  }
  return isSystemPlatformCompanyName(input.name);
}

/** Lunch customer company row — belongs under a provider, not in Superadmin main list. */
export function isLunchCustomerCompanyRow(input: {
  id: string;
  provider_id?: string | null;
  name?: string | null;
}): boolean {
  if (!safeStr(input.id)) return false;
  if (isSystemPlatformCompanyName(input.name)) return false;
  return Boolean(safeStr(input.provider_id));
}

export function isSuperadminMainListProviderRow(input: { id: string; name?: string | null }): boolean {
  return Boolean(safeStr(input.id)) && Boolean(safeStr(input.name));
}

export function isProtectedSystemCompany(input: {
  companyName: string | null;
  organizationMetadata?: OrganizationMetadata | null;
}): boolean {
  if (isSystemPlatformCompanyName(input.companyName)) return true;
  if (
    input.organizationMetadata &&
    isSystemPlatformOrganization({
      name: input.companyName,
      metadata: input.organizationMetadata,
      legacy_source: "company",
    })
  ) {
    return true;
  }
  return false;
}

export const PROTECTED_SYSTEM_COMPANY_MESSAGE =
  "Lunchportalen er systemorganisasjon og kan ikke slettes.";
