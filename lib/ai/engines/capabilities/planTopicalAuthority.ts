/**
 * AI topical authority planner capability: planTopicalAuthority.
 * Plans a topical authority structure: pillar topic + content clusters (overview, how-to, benefits, FAQ, examples, best practices).
 * Optionally compares against existing content to surface gaps. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "planTopicalAuthority";

const planTopicalAuthorityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Plans topical authority for a core topic: suggests a pillar page and content clusters (overview, how it works, benefits, FAQ, examples, best practices). Can compare with existing content to identify gaps and recommend order.",
  requiredContext: ["coreTopic"],
  inputSchema: {
    type: "object",
    description: "Topical authority plan input",
    properties: {
      coreTopic: { type: "string", description: "Core topic or theme to plan authority for" },
      existingTitles: {
        type: "array",
        description: "Existing page titles or paths to detect coverage gaps",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for suggested titles" },
    },
    required: ["coreTopic"],
  },
  outputSchema: {
    type: "object",
    description: "Topical authority plan",
    required: ["coreTopic", "pillar", "clusters", "contentGaps", "recommendedOrder", "summary"],
    properties: {
      coreTopic: { type: "string" },
      pillar: {
        type: "object",
        required: ["suggestedTitle", "rationale"],
        properties: {
          suggestedTitle: { type: "string" },
          rationale: { type: "string" },
        },
      },
      clusters: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "suggestedTitle", "priority", "rationale"],
          properties: {
            type: { type: "string" },
            suggestedTitle: { type: "string" },
            priority: { type: "number" },
            rationale: { type: "string" },
          },
        },
      },
      contentGaps: { type: "array", items: { type: "string" } },
      recommendedOrder: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is plan/suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(planTopicalAuthorityCapability);

export type PlanTopicalAuthorityInput = {
  coreTopic: string;
  existingTitles?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type TopicClusterItem = {
  type: string;
  suggestedTitle: string;
  priority: number;
  rationale: string;
};

export type PlanTopicalAuthorityOutput = {
  coreTopic: string;
  pillar: { suggestedTitle: string; rationale: string };
  clusters: TopicClusterItem[];
  contentGaps: string[];
  recommendedOrder: string[];
  summary: string;
};

type ClusterDef = {
  type: string;
  titleEn: (topic: string) => string;
  titleNb: (topic: string) => string;
  rationaleEn: string;
  rationaleNb: string;
  priority: number;
};

const CLUSTER_DEFS: ClusterDef[] = [
  {
    type: "overview",
    titleEn: (t) => `${t}: Overview and Guide`,
    titleNb: (t) => `${t}: Oversikt og veiledning`,
    rationaleEn: "Anchor page that defines the topic and links to clusters.",
    rationaleNb: "Ankerside som definerer temaet og lenker til klynger.",
    priority: 1,
  },
  {
    type: "how_it_works",
    titleEn: (t) => `How ${t} Works`,
    titleNb: (t) => `Slik fungerer ${t}`,
    rationaleEn: "Explains mechanics and process; builds depth.",
    rationaleNb: "Forklarer mekanikk og prosess; bygger dybde.",
    priority: 2,
  },
  {
    type: "benefits",
    titleEn: (t) => `Benefits of ${t}`,
    titleNb: (t) => `Fordeler med ${t}`,
    rationaleEn: "Value-focused content; supports commercial intent.",
    rationaleNb: "Verdi-fokusert innhold; støtter kommersiell intensjon.",
    priority: 3,
  },
  {
    type: "faq",
    titleEn: (t) => `${t}: Frequently Asked Questions`,
    titleNb: (t) => `${t}: Vanlige spørsmål`,
    rationaleEn: "Captures question queries and featured snippets.",
    rationaleNb: "Fanger opp spørsmålssøk og uthevede snippeter.",
    priority: 4,
  },
  {
    type: "examples",
    titleEn: (t) => `${t}: Examples and Use Cases`,
    titleNb: (t) => `${t}: Eksempler og bruksområder`,
    rationaleEn: "Concrete evidence of expertise.",
    rationaleNb: "Konkrete eksempler som viser ekspertise.",
    priority: 5,
  },
  {
    type: "best_practices",
    titleEn: (t) => `Best Practices for ${t}`,
    titleNb: (t) => `Beste praksis for ${t}`,
    rationaleEn: "Actionable advice; strengthens authority.",
    rationaleNb: "Handlingsorientert råd; styrker autoritet.",
    priority: 6,
  },
];

function normalizeTopic(s: string): string {
  const t = (s ?? "").trim();
  if (!t) return "Topic";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function titleMatchesCluster(existingTitle: string, clusterType: string): boolean {
  const lower = existingTitle.toLowerCase();
  const typeLower = clusterType.toLowerCase();
  const signals: Record<string, string[]> = {
    overview: ["overview", "oversikt", "guide", "veiledning", "introduction", "introduksjon"],
    how_it_works: ["how it works", "how does", "slik fungerer", "fungerer", "works"],
    benefits: ["benefits", "fordeler", "advantages", "fordeler"],
    faq: ["faq", "frequently asked", "vanlige spørsmål", "spørsmål", "questions"],
    examples: ["examples", "eksempler", "use cases", "bruksområder", "cases"],
    best_practices: ["best practices", "beste praksis", "tips", "guidelines", "retningslinjer"],
  };
  const terms = signals[typeLower];
  if (!terms) return false;
  return terms.some((term) => lower.includes(term));
}

/**
 * Plans topical authority structure for a core topic. Deterministic; no external calls.
 */
export function planTopicalAuthority(input: PlanTopicalAuthorityInput): PlanTopicalAuthorityOutput {
  const coreTopic = normalizeTopic(input.coreTopic ?? "");
  const isEn = input.locale === "en";
  const existing = Array.isArray(input.existingTitles)
    ? input.existingTitles
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const pillarTitle = isEn
    ? `${coreTopic}: Complete Guide`
    : `${coreTopic}: Komplett guide`;
  const pillarRationale = isEn
    ? "Single pillar page that covers the topic at a high level and links to cluster content."
    : "Én pillarside som dekker temaet på overordnet nivå og lenker til klynger.";

  const clusters: TopicClusterItem[] = CLUSTER_DEFS.map((def) => ({
    type: def.type,
    suggestedTitle: isEn ? def.titleEn(coreTopic) : def.titleNb(coreTopic),
    priority: def.priority,
    rationale: isEn ? def.rationaleEn : def.rationaleNb,
  }));

  const contentGaps: string[] = [];
  for (const def of CLUSTER_DEFS) {
    const covered = existing.some((title) => titleMatchesCluster(title, def.type));
    if (!covered) {
      contentGaps.push(
        isEn ? `Missing cluster: ${def.type} (e.g. "${def.titleEn(coreTopic)}")` : `Mangler klynger: ${def.type} (f.eks. «${def.titleNb(coreTopic)}»)`
      );
    }
  }

  const recommendedOrder = [
    pillarTitle,
    ...clusters.sort((a, b) => a.priority - b.priority).map((c) => c.suggestedTitle),
  ];

  const summary = isEn
    ? `Topical authority plan for "${coreTopic}": 1 pillar + ${clusters.length} clusters. ${contentGaps.length} gap(s) vs existing content.`
    : `Tema-autoritetsplan for «${coreTopic}»: 1 pillar + ${clusters.length} klynger. ${contentGaps.length} hull mot eksisterende innhold.`;

  return {
    coreTopic,
    pillar: { suggestedTitle: pillarTitle, rationale: pillarRationale },
    clusters,
    contentGaps,
    recommendedOrder,
    summary,
  };
}

export { planTopicalAuthorityCapability, CAPABILITY_NAME };
