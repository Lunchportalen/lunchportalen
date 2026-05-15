import "server-only";

export type CompanyOrderSummaryUserRow = {
  user_id: string;
  display_name: string;
  active_order_count: number;
  meal_units: number;
  subtotal_cents_ex_vat: number;
  vat_cents: number;
  gross_cents_inc_vat: number;
};

export type CompanyOrderSummaryPayload = {
  company_id: string;
  period_start: string;
  period_end: string;
  total_meal_units: number;
  active_order_count: number;
  total_subtotal_cents_ex_vat: number;
  total_vat_cents: number;
  total_gross_cents_inc_vat: number;
  per_user: CompanyOrderSummaryUserRow[];
};
