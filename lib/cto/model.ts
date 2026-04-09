import { num } from "@/lib/finance/numbers";

import type { BusinessModel, CtoCollectedData } from "./types";

/**
 * Bygger KPI-modell fra innsamlet data. Ordreantall = sannhet for aktivitet.
 */
export function buildBusinessModel(data: CtoCollectedData): BusinessModel {
  const ordersIn = Array.isArray(data.orders) ? data.orders : [];
  const leadsIn = Array.isArray(data.leads) ? data.leads : [];
  const logsIn = Array.isArray(data.logs) ? data.logs : [];

  const revenue = ordersIn.reduce((sum, o) => sum + num(o.line_total ?? o.total_amount), 0);
  const leads = leadsIn.length;
  const orders = ordersIn.length;
  const conversion = leads > 0 ? orders / leads : 0;

  return {
    revenue,
    leads,
    orders,
    conversion,
    activityLogRows: logsIn.length,
  };
}
