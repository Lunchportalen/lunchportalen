/**
 * Multi-page generator capability: generateSitePages.
 * Generates full block content for multiple pages from a list of page specs (path, title, goal).
 * Uses buildPageFromPrompt per page; deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { buildPageFromPrompt } from "./buildPageFromPrompt";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateSitePages";

const generateSitePagesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Multi-page generator: generates full block content for multiple pages from page specs (path, title, goal). Returns an array of pages with path, title, summary, and blocks. Uses buildPageFromPrompt per page. Deterministic; no LLM.",
  requiredContext: ["pages"],
  inputSchema: {
    type: "object",
    description: "Generate site pages input",
    properties: {
      pages: {
        type: "array",
        description: "Page specs: path, title, goal (and optional pageType)",
        items: {
          type: "object",
          required: ["path", "title", "goal"],
          properties: {
            path: { type: "string", description: "Page path (e.g. /, /kontakt, /om-oss)" },
            title: { type: "string", description: "Page title" },
            goal: { type: "string", description: "Page goal (e.g. lead, contact, signup, info, pricing)" },
            pageType: {
              type: "string",
              description: "Optional override: landing | contact | info | pricing | generic",
            },
          },
        },
      },
      audience: { type: "string", description: "Shared target audience for all pages" },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
      maxPages: { type: "number", description: "Optional max pages to generate (default 20)" },
    },
    required: ["pages"],
  },
  outputSchema: {
    type: "object",
    description: "Generated multi-page result",
    required: ["pages", "summary"],
    properties: {
      pages: {
        type: "array",
        description: "Generated pages with path, title, summary, blocks",
        items: {
          type: "object",
          required: ["path", "title", "blocks"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            pageType: { type: "string" },
            blocks: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "type", "data"],
                properties: {
                  id: { type: "string" },
                  type: { type: "string" },
                  data: { type: "object" },
                },
              },
            },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "no_user_content_injection", description: "Titles and goals used for copy only; no raw HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateSitePagesCapability);

export type GenerateSitePagesPageSpec = {
  path: string;
  title: string;
  goal: string;
  pageType?: "landing" | "contact" | "info" | "pricing" | "generic" | null;
};

export type GenerateSitePagesInput = {
  pages: GenerateSitePagesPageSpec[];
  audience?: string | null;
  locale?: "nb" | "en" | null;
  maxPages?: number | null;
};

export type GeneratedPageWithBlocks = {
  path: string;
  title: string;
  summary: string;
  pageType: string;
  blocks: BlockNode[];
};

export type GenerateSitePagesOutput = {
  pages: GeneratedPageWithBlocks[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Generates full block content for multiple pages from page specs.
 * Calls buildPageFromPrompt for each spec. Deterministic; no external calls.
 */
export function generateSitePages(input: GenerateSitePagesInput): GenerateSitePagesOutput {
  const audience = safeStr(input.audience) || (input.locale === "en" ? "Visitors" : "Besøkende");
  const locale = input.locale === "en" ? "en" : "nb";
  const maxPages = Math.min(50, Math.max(1, Math.floor(Number(input.maxPages) ?? 20)));

  const specs = Array.isArray(input.pages)
    ? input.pages
        .filter(
          (p): p is GenerateSitePagesPageSpec =>
            p != null &&
            typeof p === "object" &&
            typeof (p as GenerateSitePagesPageSpec).path === "string" &&
            typeof (p as GenerateSitePagesPageSpec).title === "string" &&
            typeof (p as GenerateSitePagesPageSpec).goal === "string"
        )
        .slice(0, maxPages)
    : [];

  const pages: GeneratedPageWithBlocks[] = [];
  for (const spec of specs) {
    const path = safeStr(spec.path) || "/";
    const title = safeStr(spec.title) || (locale === "en" ? "Page" : "Side");
    const goal = safeStr(spec.goal) || (locale === "en" ? "Inform" : "Informere");

    const result = buildPageFromPrompt({
      topic: title,
      audience,
      goal,
      locale,
    });

    pages.push({
      path,
      title: result.title,
      summary: result.summary ?? "",
      pageType: result.pageType ?? "generic",
      blocks: result.blocks ?? [],
    });
  }

  const isEn = locale === "en";
  const summary = isEn
    ? `Generated ${pages.length} page(s) with full block content. Review and save as drafts.`
    : `Genererte ${pages.length} side(r) med fullt blokkinnhold. Gjennomgå og lagre som kladder.`;

  return {
    pages,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateSitePagesCapability, CAPABILITY_NAME };
