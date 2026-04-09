/**
 * Pure CMS block normalization (client + server safe).
 * Shared by layout AI, page builder, and editor hooks.
 */

import { newBlockId } from "@/lib/cms/model/blockId";

export type CmsSerializedBlock =
  | {
      id: string;
      type: "hero";
      title: string;
      subtitle?: string;
      imageId?: string;
      imageAlt?: string;
      ctaLabel?: string;
      ctaHref?: string;
    }
  | {
      id: string;
      type: "richText";
      heading?: string;
      body: string;
    }
  | {
      id: string;
      type: "image";
      imageId: string;
      alt?: string;
      caption?: string;
    }
  | {
      id: string;
      type: "cta";
      title: string;
      body?: string;
      buttonLabel?: string;
      buttonHref?: string;
    };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Normalizes loose AI / JSON blocks into CMS-serializable blocks (ids assigned).
 */
export function normalizeLayoutBlocks(raw: unknown): CmsSerializedBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: CmsSerializedBlock[] = [];

  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const type = str(item.type).trim();
    const data = isPlainObject(item.data) ? item.data : item;
    const id = newBlockId();

    if (type === "hero") {
      const imageId =
        str(data.imageId) ||
        str(data.imageUrl) ||
        str((data as { assetPath?: unknown }).assetPath) ||
        undefined;
      out.push({
        id,
        type: "hero",
        title: str(data.title, "Velkommen"),
        subtitle: str(data.subtitle) || undefined,
        imageId: imageId || undefined,
        imageAlt: str(data.imageAlt) || undefined,
        ctaLabel: str(data.ctaLabel) || undefined,
        ctaHref: str(data.ctaHref) || undefined,
      });
      continue;
    }

    if (type === "richText" || type === "text") {
      const body = str(data.body, str(data.text, ""));
      if (!body.trim()) continue;
      out.push({
        id,
        type: "richText",
        heading: str(data.heading) || undefined,
        body,
      });
      continue;
    }

    if (type === "image") {
      const imageId = str(data.imageId, str(data.assetPath, str(data.url, "")));
      if (!imageId.trim()) continue;
      out.push({
        id,
        type: "image",
        imageId,
        alt: str(data.alt) || undefined,
        caption: str(data.caption) || undefined,
      });
      continue;
    }

    if (type === "cta") {
      out.push({
        id,
        type: "cta",
        title: str(data.title, "Neste steg"),
        body: str(data.body) || undefined,
        buttonLabel: str(data.buttonLabel, "Kontakt"),
        buttonHref: str(data.buttonHref, "/kontakt"),
      });
    }
  }

  return out.slice(0, 24);
}

export function ensureTrailingCta(blocks: CmsSerializedBlock[]): CmsSerializedBlock[] {
  if (blocks.some((b) => b.type === "cta")) return blocks;
  return [
    ...blocks,
    {
      id: newBlockId(),
      type: "cta" as const,
      title: "Kom i gang",
      body: "Ta kontakt for en uforpliktende prat.",
      buttonLabel: "Kontakt oss",
      buttonHref: "/kontakt",
    },
  ];
}

export function buildDeterministicLayout(prompt: string): CmsSerializedBlock[] {
  const line = prompt.trim().split("\n")[0]?.slice(0, 80).trim() || "Ny side";
  const idHero = newBlockId();
  const idText = newBlockId();
  const idCta = newBlockId();
  return [
    {
      id: idHero,
      type: "hero",
      title: line,
      subtitle: "En enkel og forutsigbar lunsjløsning for moderne arbeidsplasser.",
      imageId: "",
      imageAlt: "",
      ctaLabel: "Les mer",
      ctaHref: "/kontakt",
    },
    {
      id: idText,
      type: "richText",
      heading: "Hvorfor dette matter",
      body: `Basert på beskrivelsen «${line}» kan dere utdype verdiforslag, målgruppe og neste steg her.\n\nHold avsnitt korte og konkrete.`,
    },
    {
      id: idCta,
      type: "cta",
      title: "Neste steg",
      body: "Vi hjelper dere i gang uten unødvendig kompleksitet.",
      buttonLabel: "Book samtale",
      buttonHref: "/kontakt",
    },
  ];
}
