import type { SystemDataBundle } from "./collect";

export type FunnelMetrics = {
  clicks: number;
  leads: number;
  orders: number;
  clickToLead: number;
  leadToOrder: number;
  explain: string;
};

/**
 * Ratios from counted rows in the same time window (explainable).
 */
export function analyzeFunnel(data: SystemDataBundle): FunnelMetrics {
  const clicks = data.counts.socialClicks;
  const leads = data.counts.leads;
  const orders = data.counts.orders;

  const clickToLead = clicks > 0 ? leads / clicks : leads > 0 ? 1 : 0;
  const leadToOrder = leads > 0 ? orders / leads : orders > 0 ? 1 : 0;

  return {
    clicks,
    leads,
    orders,
    clickToLead,
    leadToOrder,
    explain: `Trakt: social_click=${clicks}, lead_pipeline=${leads}, orders=${orders}. Forhold: click→lead=${clickToLead.toFixed(4)}, lead→order=${leadToOrder.toFixed(4)}.`,
  };
}
