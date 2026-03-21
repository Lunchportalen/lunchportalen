/**
 * Automatic article generator capability: autoGenerateArticle.
 * Runs on approved topics: produces article structure (outline, sections) and optional
 * block list (hero, richText sections, CTA) for CMS. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "autoGenerateArticle";

const autoGenerateArticleCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Automatic article generator: runs on approved topics. Produces article title, slug, outline (sections with heading and placeholder body), and optional blocks (hero, richText sections, CTA) for CMS. Article type (how_to, listicle, faq, article) shapes structure. Deterministic; no LLM.",
  requiredContext: ["topic"],
  inputSchema: {
    type: "object",
    description: "Auto-generate article input (approved topic)",
    properties: {
      topic: {
        type: "object",
        description: "Approved topic",
        required: ["title"],
        properties: {
          title: { type: "string", description: "Article title or headline" },
          type: {
            type: "string",
            description: "how_to | listicle | faq | article (default article)",
          },
          keywords: { type: "array", items: { type: "string" } },
          slug: { type: "string", description: "Optional URL slug" },
        },
      },
      audience: { type: "string", description: "Target audience" },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
      includeBlocks: { type: "boolean", description: "Include BlockNode[] for CMS (default true)" },
      sectionCount: { type: "number", description: "Override sections (how_to/listicle); default by type" },
    },
    required: ["topic"],
  },
  outputSchema: {
    type: "object",
    description: "Generated article",
    required: ["title", "slug", "outline", "summary"],
    properties: {
      title: { type: "string" },
      slug: { type: "string" },
      outline: {
        type: "array",
        items: {
          type: "object",
          required: ["heading", "bodyPlaceholder"],
          properties: {
            heading: { type: "string" },
            bodyPlaceholder: { type: "string" },
          },
        },
      },
      blocks: {
        type: "array",
        description: "BlockNode[] for CMS when includeBlocks true",
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
      summary: { type: "string" },
      articleType: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "no_user_content_injection", description: "Topic used for copy only; no raw HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(autoGenerateArticleCapability);

export type ApprovedTopic = {
  title: string;
  type?: "how_to" | "listicle" | "faq" | "article" | null;
  keywords?: string[] | null;
  slug?: string | null;
};

export type AutoGenerateArticleInput = {
  topic: ApprovedTopic;
  audience?: string | null;
  locale?: "nb" | "en" | null;
  includeBlocks?: boolean | null;
  sectionCount?: number | null;
};

export type ArticleOutlineSection = {
  heading: string;
  bodyPlaceholder: string;
};

export type AutoGenerateArticleOutput = {
  title: string;
  slug: string;
  outline: ArticleOutlineSection[];
  blocks: BlockNode[];
  summary: string;
  articleType: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "article";
}

function sectionCountForType(type: string, override: number | null): number {
  if (override != null && override >= 1 && override <= 15) return override;
  switch (type) {
    case "how_to":
      return 5;
    case "listicle":
      return 6;
    case "faq":
      return 4;
    default:
      return 4;
  }
}

/**
 * Generates article structure and optional blocks from approved topic. Deterministic; no external calls.
 */
export function autoGenerateArticle(input: AutoGenerateArticleInput): AutoGenerateArticleOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const includeBlocks = input.includeBlocks !== false;

  const topic = input.topic && typeof input.topic === "object" ? input.topic : { title: "" };
  const title = safeStr(topic.title) || (isEn ? "Article" : "Artikkel");
  const articleType = safeStr(topic.type).toLowerCase() || "article";
  const validType = ["how_to", "listicle", "faq", "article"].includes(articleType) ? articleType : "article";
  const slug = safeStr(topic.slug) || slugFromTitle(title);
  const audience = safeStr(input.audience) || (isEn ? "Readers" : "Lesere");
  const n = sectionCountForType(validType, input.sectionCount ?? null);

  const outline: ArticleOutlineSection[] = [];

  if (validType === "how_to") {
    outline.push({
      heading: isEn ? "Introduction" : "Introduksjon",
      bodyPlaceholder: isEn ? `Brief intro to ${title}. What the reader will learn.` : `Kort intro til ${title}. Hva leseren vil lære.`,
    });
    for (let i = 1; i <= n - 2; i++) {
      outline.push({
        heading: isEn ? `Step ${i}` : `Steg ${i}`,
        bodyPlaceholder: isEn ? `Describe step ${i}. Be specific.` : `Beskriv steg ${i}. Vær konkret.`,
      });
    }
    outline.push({
      heading: isEn ? "Conclusion" : "Konklusjon",
      bodyPlaceholder: isEn ? "Summarize and next steps." : "Oppsummer og neste steg.",
    });
  } else if (validType === "listicle") {
    outline.push({
      heading: isEn ? "Introduction" : "Introduksjon",
      bodyPlaceholder: isEn ? `Why ${title} matters. What to expect.` : `Hvorfor ${title} er relevant. Hva du kan forvente.`,
    });
    for (let i = 1; i <= n - 2; i++) {
      outline.push({
        heading: isEn ? `Item ${i}` : `Punkt ${i}`,
        bodyPlaceholder: isEn ? `Describe item ${i}.` : `Beskriv punkt ${i}.`,
      });
    }
    outline.push({
      heading: isEn ? "Summary" : "Oppsummering",
      bodyPlaceholder: isEn ? "Recap and call to action." : "Oppsummering og oppfordring til handling.",
    });
  } else if (validType === "faq") {
    outline.push({
      heading: isEn ? "Overview" : "Oversikt",
      bodyPlaceholder: isEn ? `Short overview of ${title}.` : `Kort oversikt over ${title}.`,
    });
    for (let i = 1; i <= n - 1; i++) {
      outline.push({
        heading: isEn ? `Question ${i}` : `Spørsmål ${i}`,
        bodyPlaceholder: isEn ? "Question and answer." : "Spørsmål og svar.",
      });
    }
  } else {
    outline.push({
      heading: isEn ? "Introduction" : "Introduksjon",
      bodyPlaceholder: isEn ? `Introduce ${title} for ${audience}.` : `Introduksjon til ${title} for ${audience}.`,
    });
    for (let i = 2; i <= n - 1; i++) {
      outline.push({
        heading: isEn ? `Section ${i}` : `Seksjon ${i}`,
        bodyPlaceholder: isEn ? "Develop the theme. Use examples." : "Utvikl temaet. Bruk eksempler.",
      });
    }
    outline.push({
      heading: isEn ? "Conclusion" : "Konklusjon",
      bodyPlaceholder: isEn ? "Summarize and suggest next steps." : "Oppsummer og foreslå neste steg.",
    });
  }

  const blocks: BlockNode[] = [];
  if (includeBlocks) {
    const mk = (type: string, data: Record<string, unknown>): BlockNode => ({
      id: newBlockId(),
      type,
      data,
    });
    blocks.push(
      mk("hero", {
        title,
        subtitle: isEn ? `For ${audience}. Edit and publish.` : `For ${audience}. Rediger og publiser.`,
        ctaLabel: isEn ? "Read more" : "Les mer",
        ctaHref: "#",
        imageUrl: "",
        imageAlt: "",
      })
    );
    for (const section of outline) {
      blocks.push(
        mk("richText", {
          heading: section.heading,
          body: section.bodyPlaceholder,
        })
      );
    }
    blocks.push(
      mk("cta", {
        title: isEn ? "Ready for more?" : "Klar for mer?",
        body: isEn ? "Explore related content or get in touch." : "Utforsk relatert innhold eller ta kontakt.",
        buttonLabel: isEn ? "Contact" : "Kontakt",
        buttonHref: "/kontakt",
      })
    );
  }

  const summary = isEn
    ? `Article «${title}» (${validType}): ${outline.length} section(s). ${includeBlocks ? `${blocks.length} block(s) ready for CMS.` : "Set includeBlocks true for block output."}`
    : `Artikkel «${title}» (${validType}): ${outline.length} seksjon(er). ${includeBlocks ? `${blocks.length} blokk(er) klare for CMS.` : "Sett includeBlocks true for blokk-utdata."}`;

  return {
    title,
    slug,
    outline,
    blocks,
    summary,
    articleType: validType,
    generatedAt: new Date().toISOString(),
  };
}

export { autoGenerateArticleCapability, CAPABILITY_NAME };
