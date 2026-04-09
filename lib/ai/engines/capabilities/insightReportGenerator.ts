/**
 * AI Insight Report Generator capability: generateInsightReport.
 * Automatiske rapporter til: admin, superadmin, kjøkken.
 * Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "insightReportGenerator";

const insightReportGeneratorCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Insight report generator: automatic reports for admin, superadmin, and kitchen. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Insight report generator input",
    properties: {
      audience: {
        type: "string",
        enum: ["admin", "superadmin", "kitchen"],
        description: "Report audience",
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
      sections: {
        type: "array",
        description: "Optional pre-filled report sections",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
          },
        },
      },
      highlights: {
        type: "array",
        items: { type: "string" },
        description: "Optional bullet points for summary",
      },
    },
    required: ["audience"],
  },
  outputSchema: {
    type: "object",
    description: "Generated insight report",
    required: ["reportId", "audience", "reportTitle", "reportSummary", "sections", "generatedAt"],
    properties: {
      reportId: { type: "string" },
      audience: { type: "string" },
      reportTitle: { type: "string" },
      reportSummary: { type: "string" },
      sections: { type: "array", items: { type: "object" } },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "report_only",
      description: "Output is report content only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(insightReportGeneratorCapability);

export type InsightReportAudience = "admin" | "superadmin" | "kitchen";

export type ReportSectionInput = {
  title: string;
  content: string;
};

export type InsightReportGeneratorInput = {
  audience: InsightReportAudience;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
  sections?: ReportSectionInput[] | null;
  highlights?: string[] | null;
};

export type InsightReportSection = {
  title: string;
  content: string;
};

export type InsightReportGeneratorOutput = {
  reportId: string;
  audience: InsightReportAudience;
  reportTitle: string;
  reportSummary: string;
  sections: InsightReportSection[];
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Generates an automatic insight report for the given audience (admin, superadmin, kitchen). Deterministic.
 */
export function generateInsightReport(
  input: InsightReportGeneratorInput
): InsightReportGeneratorOutput {
  const isEn = input.locale === "en";
  const audience = input.audience;
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");
  const customSections = Array.isArray(input.sections) ? input.sections : [];
  const highlights = Array.isArray(input.highlights) ? input.highlights : [];

  const reportId = `insight-${audience}-${Date.now()}`;

  let reportTitle: string;
  let defaultSummary: string;
  let defaultSections: InsightReportSection[];

  if (audience === "admin") {
    reportTitle = isEn ? "Admin insight report" : "Admin-innsiktsrapport";
    defaultSummary = isEn
      ? `Automatic insight report for company admin for ${periodLabel}. Add sections or highlights when calling to include KPIs, popular dishes, and orders.`
      : `Automatisk innsiktsrapport for bedriftsadmin for ${periodLabel}. Legg inn seksjoner eller høydepunkter ved kall for å inkludere KPI-er, populære retter og bestillinger.`;
    defaultSections = isEn
      ? [
          { title: "Overview", content: "Summary of key metrics and activity for your company." },
          { title: "Orders & volume", content: "Order trends and delivery volume in the period." },
          { title: "Recommendations", content: "Suggested actions based on usage and trends." },
        ]
      : [
          { title: "Oversikt", content: "Oppsummering av nøkkeltall og aktivitet for ditt firma." },
          { title: "Bestillinger og volum", content: "Bestillingstrender og leveringsvolum i perioden." },
          { title: "Anbefalinger", content: "Foreslåtte tiltak basert på bruk og trender." },
        ];
  } else if (audience === "superadmin") {
    reportTitle = isEn ? "Superadmin insight report" : "Superadmin-innsiktsrapport";
    defaultSummary = isEn
      ? `System-wide insight report for superadmin for ${periodLabel}. Add sections or highlights to include company count, health, and risks.`
      : `Systemomspennende innsiktsrapport for superadmin for ${periodLabel}. Legg inn seksjoner eller høydepunkter for antall firmaer, helse og risiko.`;
    defaultSections = isEn
      ? [
          { title: "System overview", content: "Aggregated KPIs and system health." },
          { title: "Companies & usage", content: "Company count, active agreements, and usage trends." },
          { title: "Risks & actions", content: "Identified risks and recommended actions." },
        ]
      : [
          { title: "Systemoversikt", content: "Samlede KPI-er og systemhelse." },
          { title: "Firmaer og bruk", content: "Antall firmaer, aktive avtaler og brukstrender." },
          { title: "Risiko og tiltak", content: "Identifiserte risici og anbefalte tiltak." },
        ];
  } else {
    reportTitle = isEn ? "Kitchen insight report" : "Kjøkken-innsiktsrapport";
    defaultSummary = isEn
      ? `Automatic report for kitchen for ${periodLabel}. Add sections or highlights to include load, risks, and procurement.`
      : `Automatisk rapport for kjøkken for ${periodLabel}. Legg inn seksjoner eller høydepunkter for belastning, risiko og innkjøp.`;
    defaultSections = isEn
      ? [
          { title: "Today’s load", content: "Planned orders and capacity per slot." },
          { title: "Risks & alerts", content: "Volume spikes, delay risk, undercapacity." },
          { title: "Procurement", content: "Suggested orders and delivery dates." },
        ]
      : [
          { title: "Dagens belastning", content: "Planlagte bestillinger og kapasitet per vindu." },
          { title: "Risiko og varsler", content: "Volumspike, forsinkelsesrisiko, underkapasitet." },
          { title: "Innkjøp", content: "Foreslåtte bestillinger og leveringsdatoer." },
        ];
  }

  const sections: InsightReportSection[] =
    customSections.length > 0
      ? customSections.map((s) => ({
          title: safeStr(s.title) || (isEn ? "Section" : "Seksjon"),
          content: safeStr(s.content) || "",
        }))
      : defaultSections;

  const reportSummary =
    highlights.length > 0
      ? highlights.join(isEn ? " " : " ")
      : defaultSummary;

  return {
    reportId,
    audience,
    reportTitle,
    reportSummary,
    sections,
    generatedAt: new Date().toISOString(),
  };
}
