/**
 * AI INSIGHT REPORT GENERATOR ENGINE
 * Automatiske rapporter til: admin, superadmin, kjøkken.
 */

import { generateInsightReport } from "@/lib/ai/capabilities/insightReportGenerator";
import type {
  InsightReportGeneratorInput,
  InsightReportGeneratorOutput,
  InsightReportAudience,
  ReportSectionInput,
  InsightReportSection,
} from "@/lib/ai/capabilities/insightReportGenerator";

export type {
  InsightReportAudience,
  ReportSectionInput,
  InsightReportSection,
};

/** Genererer automatisk innsiktsrapport for angitt mottaker (admin, superadmin, kjøkken). */
export function getInsightReport(
  input: InsightReportGeneratorInput
): InsightReportGeneratorOutput {
  return generateInsightReport(input);
}

export type InsightReportGeneratorEngineKind = "generate";

export type InsightReportGeneratorEngineInput = {
  kind: "generate";
  input: InsightReportGeneratorInput;
};

export type InsightReportGeneratorEngineResult = {
  kind: "generate";
  data: InsightReportGeneratorOutput;
};

/**
 * Kjører insight report generator: automatiske rapporter til admin, superadmin eller kjøkken.
 */
export function runInsightReportGeneratorEngine(
  req: InsightReportGeneratorEngineInput
): InsightReportGeneratorEngineResult {
  if (req.kind !== "generate") {
    throw new Error(
      `Unknown insight report generator kind: ${(req as InsightReportGeneratorEngineInput).kind}`
    );
  }
  return {
    kind: "generate",
    data: getInsightReport(req.input),
  };
}
