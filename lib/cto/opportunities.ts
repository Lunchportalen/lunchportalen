import type { CtoIssue, CtoOpportunity } from "./types";

/**
 * Mapper kjente issue-typer til strategiske tiltak (heuristikk, ikke forutsigelse).
 */
export function generateOpportunities(issues: CtoIssue[]): CtoOpportunity[] {
  return issues.map((i) => {
    if (i.type === "conversion_problem") {
      return {
        action: "improve_sales_sequence",
        impact: "high",
        expectedRevenueLift: 0.3,
        explain: "Tiltak mot lav lead→order: tydeligere oppfølging og måling av steg.",
      };
    }
    if (i.type === "traffic_problem") {
      return {
        action: "increase_content_output",
        impact: "high",
        expectedRevenueLift: 0.5,
        explain: "Øk topp-of-funnel: innhold og synlighet for å fylle pipeline.",
      };
    }
    if (i.type === "data_gap") {
      return {
        action: "align_lead_capture",
        impact: "medium",
        expectedRevenueLift: 0.15,
        explain: "Sørg for at ordre kan spores til lead-kilde (skjema/attributt).",
      };
    }
    return {
      action: "observe",
      impact: "low",
      expectedRevenueLift: 0.05,
      explain: i.explain || "Overvåk og mål før større investering.",
    };
  });
}
