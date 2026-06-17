import "server-only";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeOrgnr(v: unknown): string {
  return safeStr(v).replace(/\D/g, "");
}

function normalizeName(v: unknown): string {
  return safeStr(v).toLowerCase();
}

export type ProviderIdentity = {
  id: string;
  name?: string | null;
  orgNumber?: string | null;
};

export type CompanyCustomerIdentity = {
  id: string;
  name?: string | null;
  orgnr?: string | null;
};

/**
 * A lunch customer row must not be the provider's own organization.
 * ID match first; orgnr/name as deterministic fallback.
 */
export function isProviderSelfCustomer(company: CompanyCustomerIdentity, provider: ProviderIdentity): boolean {
  const companyId = safeStr(company.id);
  const providerId = safeStr(provider.id);
  if (companyId && providerId && companyId === providerId) return true;

  const companyOrgnr = normalizeOrgnr(company.orgnr);
  const providerOrgnr = normalizeOrgnr(provider.orgNumber);
  if (companyOrgnr.length >= 9 && providerOrgnr.length >= 9 && companyOrgnr === providerOrgnr) return true;

  const companyName = normalizeName(company.name);
  const providerName = normalizeName(provider.name);
  if (companyName && providerName && companyName === providerName) return true;

  return false;
}
