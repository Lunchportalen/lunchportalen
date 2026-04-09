import "server-only";

import { analyzeCro } from "@/lib/ai/croAnalyzer";
import { type CopilotBuiltContext } from "@/lib/ai/context";
import { analyzeSeo } from "@/lib/ai/seoAnalyzer";
import type { CMSContentInput } from "@/lib/ai/types";

export type CopilotSuggestion = {
  id: string;
  text: string;
  type: "seo" | "cro" | "clarity";
  targetBlockId?: string;
  applyHint?: Record<string, unknown>;
};

function classifyCroIssue(code: string): "cro" | "clarity" {
  const c = code.toLowerCase();
  if (c.includes("headline") || c.includes("verbose") || c.includes("text") || c.includes("explanation")) return "clarity";
  return "cro";
}

/**
 * Lightweight pass over a small content window — reuses SEO + CRO heuristics (sync, typically under a few ms).
 */
export function runCopilot(content: CMSContentInput, context: CopilotBuiltContext): { suggestions: CopilotSuggestion[] } {
  const seo = analyzeSeo(content);
  const cro = analyzeCro(content);
  const suggestions: CopilotSuggestion[] = [];
  let n = 0;
  const target = context.currentBlock?.id;

  for (const i of seo.issues) {
    suggestions.push({
      id: `copilot_seo_${++n}`,
      text: i.message,
      type: "seo",
      targetBlockId: target,
      applyHint: {
        domain: "seo",
        code: i.code,
        reason: i.message,
        basedOn: ["seo_rules"],
      },
    });
  }
  for (const t of seo.improvements) {
    suggestions.push({
      id: `copilot_seo_imp_${++n}`,
      text: t,
      type: "seo",
      targetBlockId: target,
      applyHint: {
        domain: "seo",
        action: "manual_edit",
        reason: t,
        basedOn: ["seo_rules"],
      },
    });
  }
  for (const i of cro.issues) {
    suggestions.push({
      id: `copilot_cro_${++n}`,
      text: i.message,
      type: classifyCroIssue(i.code),
      targetBlockId: target,
      applyHint: {
        domain: "cro",
        code: i.code,
        reason: i.message,
        basedOn: ["cro_rules"],
      },
    });
  }
  for (const t of cro.suggestions) {
    suggestions.push({
      id: `copilot_cro_s_${++n}`,
      text: t,
      type: "clarity",
      targetBlockId: target,
      applyHint: {
        domain: "cro",
        action: "manual_edit",
        reason: t,
        basedOn: ["cro_rules"],
      },
    });
  }

  const max = 14;
  return { suggestions: suggestions.slice(0, max) };
}
