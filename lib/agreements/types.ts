// lib/agreements/types.ts
export type AgreementStatus = "ACTIVE" | "PAUSED" | "CLOSED";

export type PlanTier = "BASIS" | "LUXUS";
export type WeekdayKey = "MON" | "TUE" | "WED" | "THU" | "FRI";

export type TierByDay = Partial<Record<WeekdayKey, PlanTier>>;

export type AgreementRow = {
  id: string;
  company_id: string;

  status: AgreementStatus;

  // Plan:
  plan_tier: PlanTier | null; // fallback / enkel plan
  tier_by_day: TierByDay | null; // per dag (hvis satt)

  // Binding/rammer:
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  binding_months: number | null;

  delivery_days: WeekdayKey[]; // hvilke dager leveres
  cutoff_time: string; // "08:00"
  timezone: string; // "Europe/Oslo"

  created_at?: string | null;
  updated_at?: string | null;
};

export type NormalizedAgreement = {
  id: string;
  company_id: string;
  status: AgreementStatus;

  start_date: string;
  end_date: string | null;
  binding_months: number | null;

  delivery_days: WeekdayKey[];
  cutoff_time: string;
  timezone: string;

  // Plan, normalisert:
  mode: "SINGLE" | "BY_DAY";
  plan_tier: PlanTier; // alltid satt i NORMALIZED (fallback)
  tier_by_day: TierByDay; // alltid object i NORMALIZED (kan være tom)
};

export function isWeekdayKey(v: any): v is WeekdayKey {
  return v === "MON" || v === "TUE" || v === "WED" || v === "THU" || v === "FRI";
}

export function isPlanTier(v: any): v is PlanTier {
  return v === "BASIS" || v === "LUXUS";
}
