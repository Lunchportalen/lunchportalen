import "server-only";

import type { CeoDecision, CeoGrowthAction } from "@/lib/ai/ceo/types";

function actionId(d: CeoDecision, index: number): string {
  return `${d.type}_${index}_${Math.round(d.confidence * 100)}`;
}

/**
 * Maps decisions to human-readable actions (no side effects).
 */
export function generateGrowthActions(decisions: CeoDecision[]): CeoGrowthAction[] {
  return decisions.map((d, i) => {
    const base: Omit<CeoGrowthAction, "label" | "description"> = {
      id: actionId(d, i),
      decisionType: d.type,
      confidence: d.confidence,
    };
    switch (d.type) {
      case "seo_fix":
        return {
          ...base,
          label: "SEO / CRO-tiltak",
          description: "Gjennomgå titler, meta og primær CTA på topp-sider (manuelt i CMS).",
        };
      case "content_improve":
        return {
          ...base,
          label: "Forbedre innhold",
          description: "Fullfør kladd, bruk AI-forslag i editor, kontroller kvalitet før publisering.",
        };
      case "experiment":
        return {
          ...base,
          label: "Start eksperiment",
          description: "Opprett kontrollert forsøk (f.eks. forsiden) i eksperimentmodulen.",
        };
      case "publish":
        return {
          ...base,
          label: "Kontrollert publisering",
          description: "Følg godkjent arbeidsflyt — ingen automatisk publisering fra CEO-laget.",
        };
      default:
        return {
          ...base,
          label: "Ukjent tiltak",
          description: "Ingen mapping.",
        };
    }
  });
}
