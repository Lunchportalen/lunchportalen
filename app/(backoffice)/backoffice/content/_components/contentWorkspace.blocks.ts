/**
 * Block model helpers for ContentWorkspace: parse/serialize body, normalize blocks.
 * No React, no hooks.
 */

import { safeStr, safeObj } from "./contentWorkspace.helpers";
import type {
  Block,
  BlockType,
  BannerItem,
  BannerItemButton,
} from "./editorBlockTypes";

export type BodyMode = "blocks" | "legacy" | "invalid";

export type BodyParseResult = {
  mode: BodyMode;
  blocks: Block[];
  meta: Record<string, unknown>;
  legacyText: string;
  rawBody: string;
  error: string | null;
};

export function makeBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `blk_${crypto.randomUUID()}`;
  }
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlock(type: BlockType): Block {
  const id = makeBlockId();

  if (type === "hero") {
    return { id, type, title: "", subtitle: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "" };
  }

  if (type === "richText") {
    return { id, type, heading: "", body: "" };
  }

  if (type === "image") {
    return { id, type, assetPath: "", alt: "", caption: "" };
  }

  if (type === "cta") {
    return { id, type, title: "", body: "", buttonLabel: "", buttonHref: "" };
  }

  if (type === "banners") {
    return { id, type, items: [] };
  }

  if (type === "code") {
    return { id, type, code: "", displayIntro: false, displayOutro: false };
  }

  return { id, type: "divider" as const };
}

export function isAddModalBlockTypeFromOverlay(type: string): type is BlockType {
  return (
    type === "hero" ||
    type === "richText" ||
    type === "image" ||
    type === "cta" ||
    type === "banners" ||
    type === "code" ||
    type === "divider"
  );
}

export function blockTypeSubtitle(type: BlockType, block?: Block): string {
  const upper = type === "richText" ? "RICH TEXT" : type.toUpperCase().replace(/([a-z])([A-Z])/g, "$1 $2");
  if (type === "banners" && block && block.type === "banners") {
    const n = block.items?.length ?? 0;
    return `COMPONENT: BANNERS · ITEMS: ${n}`;
  }
  if (type === "code") return "COMPONENT: CODE";
  return `COMPONENT: ${upper}`;
}

export function normalizeBlock(raw: unknown): Block | null {
  const row = safeObj(raw);
  const type = safeStr(row.type) as BlockType;
  const id = safeStr(row.id) || makeBlockId();

  if (type === "hero") {
    return {
      id,
      type,
      title: safeStr(row.title),
      subtitle: safeStr(row.subtitle),
      imageUrl: safeStr(row.imageUrl) || undefined,
      mediaItemId:
        typeof row.mediaItemId === "string" && row.mediaItemId.trim()
          ? row.mediaItemId.trim()
          : undefined,
      imageAlt: safeStr(row.imageAlt) || undefined,
      ctaLabel: safeStr(row.ctaLabel),
      ctaHref: safeStr(row.ctaHref),
    };
  }

  if (type === "richText") {
    return {
      id,
      type,
      heading: safeStr(row.heading),
      body: safeStr(row.body),
    };
  }

  if (type === "image") {
    return {
      id,
      type,
      assetPath: safeStr(row.assetPath),
      mediaItemId: typeof row.mediaItemId === "string" && row.mediaItemId.trim() ? row.mediaItemId.trim() : undefined,
      alt: safeStr(row.alt),
      caption: safeStr(row.caption),
    };
  }

  if (type === "cta") {
    return {
      id,
      type,
      title: safeStr(row.title),
      body: safeStr(row.body),
      buttonLabel: safeStr(row.buttonLabel),
      buttonHref: safeStr(row.buttonHref),
    };
  }

  if (type === "divider") {
    const style = safeStr(row.style) === "space" ? "space" : undefined;
    return { id, type, ...(style ? { style } as const : {}) };
  }

  if (type === "code") {
    return {
      id,
      type: "code",
      code: safeStr(row.code),
      displayIntro: row.displayIntro === true,
      displayOutro: row.displayOutro === true,
    };
  }

  if (type === "banners") {
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items: BannerItem[] = rawItems.map((raw: unknown) => {
      const r = safeObj(raw);
      const buttonsRaw = Array.isArray(r.buttons) ? r.buttons : [];
      const buttons: BannerItemButton[] = buttonsRaw.map((b: unknown) => {
        const x = safeObj(b);
        return { label: safeStr(x.label), href: safeStr(x.href) };
      });
      return {
        id: safeStr(r.id) || makeBlockId(),
        imageUrl: safeStr(r.imageUrl) || undefined,
        videoSource: (safeStr(r.videoSource) as "youtube" | "vimeo" | "mp4") || undefined,
        videoUrl: safeStr(r.videoUrl) || undefined,
        heading: safeStr(r.heading) || undefined,
        secondaryHeading: safeStr(r.secondaryHeading) || undefined,
        text: safeStr(r.text) || undefined,
        buttons: buttons.length ? buttons : undefined,
        bannerStyle: (safeStr(r.bannerStyle) as "takeover" | "medium" | "short" | "scale") || undefined,
        backgroundColor: safeStr(r.backgroundColor) || undefined,
        scrollPrompt: r.scrollPrompt === true,
        textAlignment: (safeStr(r.textAlignment) as "left" | "center" | "right") || undefined,
        textPosition: safeStr(r.textPosition) || undefined,
        imageOpacity: r.imageOpacity === true,
        animate: r.animate === true,
        name: safeStr(r.name) || undefined,
        anchorName: safeStr(r.anchorName) || undefined,
        customClasses: safeStr(r.customClasses) || undefined,
        hideFromWebsite: r.hideFromWebsite === true,
      };
    });
    return { id, type, items };
  }

  return null;
}

export function normalizeBlocks(raw: unknown): Block[] {
  const source = Array.isArray(raw) ? raw : [];
  return source.map(normalizeBlock).filter((b): b is Block => Boolean(b));
}

export function looksJsonLike(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function toRawBodyString(body: unknown): string {
  if (typeof body === "string") return body;
  if (body === null || body === undefined) return "";
  try {
    return JSON.stringify(body);
  } catch {
    return String(body ?? "");
  }
}

export function parseBodyToBlocks(body: unknown): BodyParseResult {
  const rawBody = toRawBodyString(body);

  if (body === null || body === undefined) {
    return {
      mode: "legacy",
      blocks: [],
      meta: {},
      legacyText: "",
      rawBody,
      error: null,
    };
  }

  if (typeof body === "object" && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    const meta = safeObj(obj.meta);

    if (!Array.isArray(obj.blocks)) {
      return {
        mode: "invalid",
        blocks: [],
        meta,
        legacyText: "",
        rawBody,
        error: "Invalid body format.",
      };
    }

    return {
      mode: "blocks",
      blocks: normalizeBlocks(obj.blocks),
      meta,
      legacyText: "",
      rawBody,
      error: null,
    };
  }

  if (typeof body === "string") {
    if (!looksJsonLike(body)) {
      return {
        mode: "legacy",
        blocks: [],
        meta: {},
        legacyText: body,
        rawBody: body,
        error: null,
      };
    }

    try {
      const parsed = JSON.parse(body) as unknown;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          mode: "invalid",
          blocks: [],
          meta: {},
          legacyText: "",
          rawBody: body,
          error: "Invalid body format.",
        };
      }

      const obj = parsed as Record<string, unknown>;
      const meta = safeObj(obj.meta);

      if (!Array.isArray(obj.blocks)) {
        return {
          mode: "invalid",
          blocks: [],
          meta,
          legacyText: "",
          rawBody: body,
          error: "Invalid body format.",
        };
      }

      return {
        mode: "blocks",
        blocks: normalizeBlocks(obj.blocks),
        meta,
        legacyText: "",
        rawBody: body,
        error: null,
      };
    } catch {
      return {
        mode: "invalid",
        blocks: [],
        meta: {},
        legacyText: "",
        rawBody: body,
        error: "Invalid body format.",
      };
    }
  }

  return {
    mode: "invalid",
    blocks: [],
    meta: {},
    legacyText: "",
    rawBody,
    error: "Invalid body format.",
  };
}

export function serializeBlocksToBody(blocks: Block[], meta: Record<string, unknown>): string {
  return JSON.stringify({ blocks, meta });
}

export function deriveBodyForSave(
  mode: BodyMode,
  blocks: Block[],
  meta: Record<string, unknown>,
  legacyText: string,
  invalidRaw: string
): string {
  if (mode === "blocks") return serializeBlocksToBody(blocks, meta);
  if (mode === "legacy") return legacyText;
  return invalidRaw;
}

export function deriveBodyFromParse(parsed: BodyParseResult): string {
  return deriveBodyForSave(
    parsed.mode,
    parsed.blocks,
    parsed.meta,
    parsed.legacyText,
    parsed.rawBody
  );
}
