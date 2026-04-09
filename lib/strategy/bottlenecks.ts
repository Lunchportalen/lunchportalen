import type { FunnelMetrics } from "./funnel";
import type { SystemDataBundle } from "./collect";
import type { BottleneckIssue } from "./types";

/**
 * Deterministiske terskler — ingen ML; vis tall i metrics.
 */
export function findBottlenecks(funnel: FunnelMetrics, data: SystemDataBundle): BottleneckIssue[] {
  const issues: BottleneckIssue[] = [];

  if (funnel.clickToLead < 0.1 && funnel.clicks >= 5) {
    issues.push({
      type: "conversion",
      stage: "click_to_lead",
      severity: "high",
      message: "Lav konvertering fra klikk til lead i vinduet",
      metrics: {
        clickToLead: funnel.clickToLead,
        clicks: funnel.clicks,
        leads: funnel.leads,
      },
    });
  }

  if (funnel.leadToOrder < 0.2 && funnel.leads >= 5) {
    issues.push({
      type: "sales",
      stage: "lead_to_order",
      severity: "high",
      message: "Lav closing rate (lead → ordre) i vinduet",
      metrics: {
        leadToOrder: funnel.leadToOrder,
        leads: funnel.leads,
        orders: funnel.orders,
      },
    });
  }

  const sample = data.logs.length;
  const errRate = sample > 0 ? data.counts.errorLikeLogs / sample : 0;
  if (sample >= 50 && errRate > 0.08) {
    issues.push({
      type: "reliability",
      stage: "reliability",
      severity: "medium",
      message: "Høy andel feilaktige / feillignende logger i sample",
      metrics: {
        errorLikeLogs: data.counts.errorLikeLogs,
        logSample: sample,
        errorRate: errRate,
      },
    });
  }

  return issues;
}
