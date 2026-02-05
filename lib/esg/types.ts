export type EsgDailyRow = {
  id: string;

  company_id: string;
  location_id: string | null;
  slot: string | null;

  date: string; // YYYY-MM-DD

  ordered_count: number;
  cancelled_in_time_count: number;
  cancelled_late_count: number;
  no_show_count: number;

  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;

  meal_price_nok: number;
  cost_ordered_nok: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;

  computed_at: string;
  computed_version: string;
};

export type EsgMonthlySnapshotRow = {
  id: string;

  company_id: string;
  location_id: string | null;

  month: string; // YYYY-MM-01

  ordered_count: number;
  cancelled_in_time_count: number;
  no_show_count: number;

  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;

  avg_meal_price_nok: number;
  cost_ordered_nok: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;

  stability_score: string | null; // 'A'|'B'|'C'|'D'
  notes: any | null;

  computed_at: string;
  computed_version: string;
};

export type EsgFactorRow = {
  id: string;
  key: "meal_kg" | "co2e_per_kg_food" | string;
  value: number;
  unit: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};
