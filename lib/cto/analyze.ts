import type { BusinessModel, CtoIssue } from "./types";

const CONVERSION_WARN = 0.2;
const LEADS_WARN = 50;

/**
 * Regelbasert analyse — samme terskler gir samme utfall (forklarbar).
 */
export function analyzeSystem(model: BusinessModel): CtoIssue[] {
  const issues: CtoIssue[] = [];

  if (model.leads > 0 && model.conversion < CONVERSION_WARN) {
    issues.push({
      type: "conversion_problem",
      message: "Lav lead → order-konvertering",
      impact: "high",
      explain: `Konvertering ${model.conversion.toFixed(4)} < terskel ${CONVERSION_WARN} (ordre ${model.orders}, leads ${model.leads}).`,
    });
  }

  if (model.leads < LEADS_WARN) {
    issues.push({
      type: "traffic_problem",
      message: "For få leads i pipeline",
      impact: "high",
      explain: `Leads ${model.leads} < terskel ${LEADS_WARN}.`,
    });
  }

  if (model.leads === 0 && model.orders > 0) {
    issues.push({
      type: "data_gap",
      message: "Ingen leads i pipeline — ordre finnes uten lead-spor",
      impact: "medium",
      explain: `Ordre ${model.orders} men leads 0; konvertering kan ikke beregnes mot pipeline.`,
    });
  }

  return issues;
}
