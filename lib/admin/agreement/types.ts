// lib/admin/agreement/types.ts
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
export type Tier = "BASIS" | "LUXUS";
export type AgreementStatus =
  | "ACTIVE"
  | "PAUSED"
  | "CLOSED"
  | "MISSING_AGREEMENT"
  | "COMPANY_DISABLED";

export type AgreementPageCompany = {
  id: string;
  name: string | null;
  orgnr?: string | null;
  locationName?: string | null;
};

export type AgreementPageData = {
  rid: string;
  company: AgreementPageCompany;
  companies: AgreementPageCompany[];
  role: "company_admin" | "superadmin";
  status: AgreementStatus;
  pricing: { planTier: Tier | null; pricePerCuvertNok: number | null; currency: "NOK" };
  binding: { startDate: string | null; endDate: string | null; remainingDays: number | null };
  weekPlan: Array<{
    dayKey: DayKey;
    label: "Man" | "Tir" | "Ons" | "Tor" | "Fre";
    active: boolean;
    tier: Tier | null;
    reasonIfInactive: string | null;
  }>;
  metrics: {
    employeesTotal: number | null;
    employeesActive: number | null;
    employeesDeactivated: number | null;
    cancelsBeforeCutoff7d: number | null;
    ordersToday: number | null;
  };
  updatedAt: string | null;
  cutoff: { time: "08:00"; timezone: "Europe/Oslo" };
  sourceOfTruth: { companyId: string; agreementId: string | null; updatedAt: string | null };
};
