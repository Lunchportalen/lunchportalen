/**
 * Product page generator capability: generateProductPage.
 * Builds a product page structure (title, summary, blocks) from product name, description,
 * optional price, image, features, and audience/tone. BlockList-compatible; deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateProductPage";

const generateProductPageCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Product page generator: builds a product page (title, summary, blocks) from product name, description, optional price, image, features, category, audience, and tone. Returns BlockList-compatible blocks (hero, richText, optional image, features, cta). Deterministic; no LLM.",
  requiredContext: ["productName", "description"],
  inputSchema: {
    type: "object",
    description: "Generate product page input",
    properties: {
      productName: { type: "string", description: "Product name" },
      description: { type: "string", description: "Product description or value proposition" },
      price: { type: "string", description: "Optional price or price range (e.g. 299 kr/mnd)" },
      imageUrl: { type: "string", description: "Optional product image URL" },
      imageAlt: { type: "string", description: "Optional image alt text" },
      features: {
        type: "array",
        description: "Optional list of features or benefits",
        items: { type: "string" },
      },
      category: { type: "string", description: "Optional product category" },
      audience: { type: "string", description: "Target audience" },
      tone: { type: "string", description: "Tone (e.g. enterprise, warm, neutral)" },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
      ctaHref: { type: "string", description: "Optional CTA link (default #bestill or /kontakt)" },
    },
    required: ["productName", "description"],
  },
  outputSchema: {
    type: "object",
    description: "Generated product page",
    required: ["title", "summary", "blocks"],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      blocks: {
        type: "array",
        description: "Block list (id, type, data)",
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
      pageType: { type: "string", description: "product" },
    },
  },
  safetyConstraints: [
    { code: "no_user_content_injection", description: "Product fields used for copy only; no raw HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateProductPageCapability);

export type GenerateProductPageInput = {
  productName: string;
  description: string;
  price?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  features?: string[] | null;
  category?: string | null;
  audience?: string | null;
  tone?: string | null;
  locale?: "nb" | "en" | null;
  ctaHref?: string | null;
};

export type GenerateProductPageOutput = {
  title: string;
  summary: string;
  blocks: BlockNode[];
  pageType: "product";
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Generates a product page (title, summary, blocks). Deterministic; no external calls.
 */
export function generateProductPage(input: GenerateProductPageInput): GenerateProductPageOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const productName = safeStr(input.productName) || (isEn ? "Product" : "Produkt");
  const description = safeStr(input.description) || (isEn ? "Product description. Edit to match your offering." : "Produktbeskrivelse. Rediger til tilbudet ditt.");
  const price = safeStr(input.price);
  const imageUrl = safeStr(input.imageUrl);
  const imageAlt = safeStr(input.imageAlt) || productName;
  const category = safeStr(input.category);
  const audience = safeStr(input.audience) || (isEn ? "Customers" : "Kunder");
  const ctaHref = safeStr(input.ctaHref) || (isEn ? "/contact" : "/kontakt");
  const features = Array.isArray(input.features)
    ? input.features.filter((f) => typeof f === "string" && (f as string).trim()).map((f) => (f as string).trim())
    : [];

  const blocks: BlockNode[] = [];
  const mk = (type: string, data: Record<string, unknown>): BlockNode => ({
    id: newBlockId(),
    type,
    data,
  });

  const subtitle = price
    ? (isEn ? `${productName} – ${price}. Clear value for ${audience}.` : `${productName} – ${price}. Tydelig verdi for ${audience}.`)
    : (isEn ? `${productName} – for ${audience}.` : `${productName} – for ${audience}.`);

  blocks.push(
    mk("hero", {
      title: productName,
      subtitle: subtitle.slice(0, 200),
      ctaLabel: isEn ? "Get started" : "Kom i gang",
      ctaHref,
      imageUrl: imageUrl || "",
      imageAlt: imageUrl ? imageAlt : "",
    })
  );

  blocks.push(
    mk("richText", {
      heading: isEn ? "About this product" : "Om dette produktet",
      body: description,
    })
  );

  if (imageUrl) {
    blocks.push(
      mk("image", {
        assetPath: imageUrl,
        alt: imageAlt,
        caption: category ? (isEn ? `Category: ${category}` : `Kategori: ${category}`) : "",
      })
    );
  }

  if (features.length > 0) {
    const featureBody = features.map((f) => `• ${f}`).join("\n");
    blocks.push(
      mk("richText", {
        heading: isEn ? "Features and benefits" : "Funksjoner og fordeler",
        body: featureBody,
      })
    );
  }

  if (category) {
    blocks.push(
      mk("richText", {
        heading: isEn ? "Category" : "Kategori",
        body: category,
      })
    );
  }

  blocks.push(
    mk("cta", {
      title: isEn ? "Ready to get started?" : "Klar for å komme i gang?",
      body: isEn ? `Choose ${productName} for ${audience}.` : `Velg ${productName} for ${audience}.`,
      buttonLabel: isEn ? "Get started" : "Kom i gang",
      buttonHref: ctaHref,
    })
  );

  const title = productName.length <= 70 ? productName : productName.slice(0, 67) + "...";
  const summary = isEn
    ? `Product page «${title}»: ${blocks.length} block(s). Review and save as draft.`
    : `Produktside «${title}»: ${blocks.length} blokk(er). Gjennomgå og lagre som kladd.`;

  return {
    title,
    summary,
    blocks,
    pageType: "product",
  };
}

export { generateProductPageCapability, CAPABILITY_NAME };
