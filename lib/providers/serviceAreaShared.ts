/** Client-safe types + labels for provider service areas (no server-only). */

export type ServiceAreaRow = {
  id: string;
  provider_id: string;
  country: string;
  city: string;
  postal_code_from: string;
  postal_code_to: string;
  min_employees: number | null;
  max_employees: number | null;
  available_days: string[];
  active: boolean;
  created_at: string;
};

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Man",
  tue: "Tir",
  wed: "Ons",
  thu: "Tor",
  fri: "Fre",
};
