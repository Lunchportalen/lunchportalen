export const COMPANY_AGREEMENT_STATUSES = ["DRAFT", "PENDING", "ACTIVE", "PAUSED", "CLOSED", "TERMINATED"] as const;

export type CompanyAgreementStatus = (typeof COMPANY_AGREEMENT_STATUSES)[number];

export function normalizeCompanyAgreementStatus(raw: any): CompanyAgreementStatus | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return (COMPANY_AGREEMENT_STATUSES as readonly string[]).includes(s) ? (s as CompanyAgreementStatus) : null;
}

