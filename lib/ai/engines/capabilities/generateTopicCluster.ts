/**
 * AI topic-cluster capability: generateTopicCluster.
 * Produces a pillar page, supporting pages, internal links, and content depth map for a topic.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateTopicCluster";

const generateTopicClusterCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates a topic cluster: one pillar page, supporting pages, internal link suggestions, and a content depth map (depth level and word-count hints per page).",
  requiredContext: ["topic"],
  inputSchema: {
    type: "object",
    description: "Generate topic cluster input",
    properties: {
      topic: { type: "string", description: "Main topic or theme for the cluster" },
      existingPagePaths: {
        type: "array",
        description: "Optional list of existing paths to consider for internal links",
        items: { type: "string" },
      },
      maxSupportingPages: { type: "number", description: "Optional max number of supporting pages (default 6)" },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["topic"],
  },
  outputSchema: {
    type: "object",
    description: "Topic cluster: pillar, supporting pages, internal links, content depth map",
    required: ["pillarPage", "supportingPages", "internalLinks", "contentDepthMap"],
    properties: {
      pillarPage: {
        type: "object",
        description: "The pillar page for the topic",
        required: ["path", "title", "description"],
        properties: {
          path: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
        },
      },
      supportingPages: {
        type: "array",
        description: "Supporting/cluster pages that link to and from the pillar",
        items: {
          type: "object",
          required: ["path", "title", "depthLevel"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            depthLevel: { type: "number", description: "1=pillar, 2=cluster, 3=detail" },
          },
        },
      },
      internalLinks: {
        type: "array",
        description: "Recommended internal links between pillar and supporting pages",
        items: {
          type: "object",
          required: ["fromPath", "toPath"],
          properties: {
            fromPath: { type: "string" },
            toPath: { type: "string" },
            anchorText: { type: "string", description: "Suggested anchor text" },
          },
        },
      },
      contentDepthMap: {
        type: "array",
        description: "Per-page content depth: depth level and suggested word count",
        items: {
          type: "object",
          required: ["path", "depthLevel"],
          properties: {
            path: { type: "string" },
            depthLevel: { type: "number" },
            suggestedWordCount: { type: "number", description: "Optional word-count hint" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "cluster_only", description: "Output is recommendations only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(generateTopicClusterCapability);

export type GenerateTopicClusterInput = {
  topic: string;
  existingPagePaths?: string[] | null;
  maxSupportingPages?: number | null;
  locale?: "nb" | "en" | null;
};

export type TopicClusterPillarPage = {
  path: string;
  title: string;
  description: string;
};

export type TopicClusterSupportingPage = {
  path: string;
  title: string;
  description?: string;
  depthLevel: number;
};

export type TopicClusterInternalLink = {
  fromPath: string;
  toPath: string;
  anchorText?: string;
};

export type TopicClusterDepthEntry = {
  path: string;
  depthLevel: number;
  suggestedWordCount?: number;
};

export type GenerateTopicClusterOutput = {
  pillarPage: TopicClusterPillarPage;
  supportingPages: TopicClusterSupportingPage[];
  internalLinks: TopicClusterInternalLink[];
  contentDepthMap: TopicClusterDepthEntry[];
};

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9-]/g, "");
}

/** Default supporting page templates (topic gets interpolated). */
function defaultSupportingTitles(topic: string, isEn: boolean): Array<{ title: string; depth: number }> {
  const t = topic.trim() || (isEn ? "Topic" : "Emne");
  if (isEn) {
    return [
      { title: `${t} – overview`, depth: 2 },
      { title: `What is ${t}?`, depth: 2 },
      { title: `Benefits of ${t}`, depth: 2 },
      { title: `How to get started with ${t}`, depth: 2 },
      { title: `${t} – FAQ`, depth: 3 },
      { title: `${t} – examples and use cases`, depth: 3 },
    ];
  }
  return [
    { title: `${t} – oversikt`, depth: 2 },
    { title: `Hva er ${t}?`, depth: 2 },
    { title: `Fordeler med ${t}`, depth: 2 },
    { title: `Kom i gang med ${t}`, depth: 2 },
    { title: `${t} – ofte stilte spørsmål`, depth: 3 },
    { title: `${t} – eksempler og bruksområder`, depth: 3 },
  ];
}

/** Word-count hints by depth: pillar ~2000+, cluster ~1200+, detail ~600+. */
function wordCountForDepth(depthLevel: number): number {
  if (depthLevel <= 1) return 2000;
  if (depthLevel === 2) return 1200;
  return 600;
}

/**
 * Generates a topic cluster: pillar page, supporting pages, internal links, and content depth map.
 * Deterministic; no external calls.
 */
export function generateTopicCluster(input: GenerateTopicClusterInput): GenerateTopicClusterOutput {
  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const isEn = input.locale === "en";
  const maxSupporting = Math.min(
    12,
    Math.max(1, Math.floor(Number(input.maxSupportingPages) ?? 6))
  );
  const existingPaths = Array.isArray(input.existingPagePaths)
    ? input.existingPagePaths.filter((p) => typeof p === "string" && p.trim()).map((p) => (p as string).trim())
    : [];

  const topicSlug = slugify(topic) || (isEn ? "topic" : "emne");
  const pillarPath = `/${topicSlug}`;
  const pillarTitle = topic || (isEn ? "Topic" : "Emne");
  const pillarDescription = isEn
    ? `Main pillar page for ${topic || "this topic"}.`
    : `Hovedpillarside for ${topic || "dette emnet"}.`;

  const pillarPage: TopicClusterPillarPage = {
    path: pillarPath,
    title: pillarTitle,
    description: pillarDescription,
  };

  const supportingTemplates = defaultSupportingTitles(topic || pillarTitle, isEn).slice(0, maxSupporting);
  const supportingPages: TopicClusterSupportingPage[] = supportingTemplates.map((st, i) => {
    const path = `${pillarPath}/${slugify(st.title)}`;
    return {
      path,
      title: st.title,
      description: undefined,
      depthLevel: st.depth,
    };
  });

  const internalLinks: TopicClusterInternalLink[] = [];
  internalLinks.push({
    fromPath: pillarPath,
    toPath: supportingPages[0]?.path ?? pillarPath,
    anchorText: supportingPages[0]?.title,
  });
  for (const sp of supportingPages) {
    internalLinks.push({ fromPath: sp.path, toPath: pillarPath, anchorText: pillarTitle });
    if (sp.path !== supportingPages[0]?.path) {
      internalLinks.push({
        fromPath: pillarPath,
        toPath: sp.path,
        anchorText: sp.title,
      });
    }
  }

  const contentDepthMap: TopicClusterDepthEntry[] = [
    { path: pillarPath, depthLevel: 1, suggestedWordCount: wordCountForDepth(1) },
    ...supportingPages.map((sp) => ({
      path: sp.path,
      depthLevel: sp.depthLevel,
      suggestedWordCount: wordCountForDepth(sp.depthLevel),
    })),
  ];

  return {
    pillarPage,
    supportingPages,
    internalLinks,
    contentDepthMap,
  };
}

export { generateTopicClusterCapability, CAPABILITY_NAME };
