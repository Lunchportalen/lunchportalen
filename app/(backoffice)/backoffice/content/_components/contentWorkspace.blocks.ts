/**
 * Block model helpers for ContentWorkspace: parse/serialize body, normalize blocks.
 * No React hooks; pure helpers + imperative block updates may use React types only.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { parseBlockConfig } from "@/lib/cms/design/designContract";
import { getBlockDefaultValuesForType } from "./blockFieldSchemas";
import { safeStr, safeObj } from "./contentWorkspace.helpers";
import type {
  Block,
  BlockType,
  CardRow,
  GridItemRow,
  PricingPlanRow,
  RichTextBlock,
  ZigzagStep,
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

/** Deep-clone block with new root id. No API/storage change. */
export function cloneBlockDeep(source: Block): Block {
  const id = makeBlockId();
  return { ...source, id };
}

function parseTriAlign(v: unknown, fallback: "left" | "center" | "right"): "left" | "center" | "right" {
  const s = safeStr(v).toLowerCase();
  if (s === "left" || s === "right" || s === "center") return s;
  return fallback;
}

function configFromRow(row: Record<string, unknown>) {
  return parseBlockConfig(row.config);
}

export function createBlock(type: BlockType): Block {
  const id = makeBlockId();

  if (type === "hero") {
    return { id, type, title: "", subtitle: "", imageId: "", imageAlt: "", ctaLabel: "", ctaHref: "" };
  }

  if (type === "richText") {
    return { id, type, heading: "", body: "" };
  }

  if (type === "image") {
    return { id, type, imageId: "", alt: "", caption: "" };
  }

  if (type === "cta") {
    return { id, type, title: "", body: "", buttonLabel: "", buttonHref: "" };
  }

  if (type === "hero_full") {
    return {
      id,
      type,
      title: "",
      subtitle: "",
      imageId: "",
      imageAlt: "",
      ctaLabel: "",
      ctaHref: "",
      useGradient: true,
    };
  }

  if (type === "hero_bleed") {
    const layoutDefaults = getBlockDefaultValuesForType("hero_bleed");
    return {
      id,
      type,
      title: "",
      subtitle: "",
      ctaPrimary: "",
      ctaSecondary: "",
      ctaPrimaryHref: "",
      ctaSecondaryHref: "",
      backgroundImageId: "",
      overlayImageId: "",
      overlayImageAlt: "",
      ...layoutDefaults,
    };
  }

  if (type === "cards") {
    return {
      id,
      type,
      title: "",
      text: "",
      items: [
        { title: "", text: "" },
        { title: "", text: "" },
        { title: "", text: "" },
      ],
      cta: [],
    };
  }

  if (type === "zigzag") {
    return {
      id,
      type,
      title: "",
      steps: [
        { step: "1", title: "", text: "", imageId: "" },
        { step: "2", title: "", text: "", imageId: "" },
      ],
    };
  }

  if (type === "pricing") {
    return {
      id,
      type,
      title: "To nivå – tydelig avtale",
      intro: "",
      plans: [],
    };
  }

  if (type === "banner") {
    return {
      id,
      type,
      text: "",
      ctaLabel: "",
      ctaHref: "",
      backgroundImageId: "",
      variant: "center",
    };
  }

  if (type === "grid") {
    return {
      id,
      type,
      title: "",
      variant: "center",
      items: [
        { title: "", imageId: "" },
        { title: "", imageId: "" },
        { title: "", imageId: "" },
      ],
    };
  }

  if (type === "form") {
    return { id, type, formId: "", title: "Form" };
  }

  if (type === "relatedLinks") {
    return { id, type, currentPath: "/", tags: [], title: "", subtitle: "" };
  }

  return { id, type: "divider" as const };
}

export function isAddModalBlockTypeFromOverlay(type: string): type is BlockType {
  return (
    type === "hero" ||
    type === "hero_full" ||
    type === "hero_bleed" ||
    type === "richText" ||
    type === "image" ||
    type === "cta" ||
    type === "cards" ||
    type === "zigzag" ||
    type === "pricing" ||
    type === "grid" ||
    type === "form" ||
    type === "relatedLinks" ||
    type === "divider"
  );
}

export function blockTypeSubtitle(type: BlockType, block?: Block): string {
  const upper = type === "richText" ? "RICH TEXT" : type.toUpperCase().replace(/([a-z])([A-Z])/g, "$1 $2");
  void block;
  return `COMPONENT: ${upper}`;
}

export function normalizeBlock(raw: unknown): Block | null {
  const top = safeObj(raw);
  const nested =
    top.data != null && typeof top.data === "object" && !Array.isArray(top.data)
      ? (top.data as Record<string, unknown>)
      : {};
  const { data: _dataOmit, ...restTop } = top;
  /** BlockNode `{ id, type, data, config? }` or flat editor rows */
  const row: Record<string, unknown> = {
    ...restTop,
    ...nested,
    id: top.id,
    type: top.type,
    ...(top.config != null ? { config: top.config } : {}),
  };
  const type = safeStr(row.type) as BlockType;
  const id = safeStr(row.id) || makeBlockId();
  const cfg = configFromRow(row);

  if (type === "hero") {
    return {
      id,
      type,
      title: safeStr(row.title),
      subtitle: safeStr(row.subtitle),
      imageId:
        safeStr(row.imageId) ||
        safeStr(row.mediaItemId) ||
        safeStr(row.imageUrl) ||
        undefined,
      mediaItemId:
        typeof row.mediaItemId === "string" && row.mediaItemId.trim()
          ? row.mediaItemId.trim()
          : undefined,
      imageAlt: safeStr(row.imageAlt) || undefined,
      ctaLabel: safeStr(row.ctaLabel),
      ctaHref: safeStr(row.ctaHref),
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "richText") {
    return {
      id,
      type,
      heading: safeStr(row.heading),
      body: safeStr(row.body),
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "image") {
    return {
      id,
      type,
      imageId:
        safeStr(row.imageId) ||
        safeStr(row.mediaItemId) ||
        safeStr(row.assetPath) ||
        "",
      mediaItemId: typeof row.mediaItemId === "string" && row.mediaItemId.trim() ? row.mediaItemId.trim() : undefined,
      alt: safeStr(row.alt),
      caption: safeStr(row.caption),
      ...(cfg ? { config: cfg } : {}),
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
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "divider") {
    const style = safeStr(row.style) === "space" ? "space" : undefined;
    return { id, type, ...(style ? ({ style } as const) : {}), ...(cfg ? { config: cfg } : {}) };
  }

  if (type === "hero_full") {
    return {
      id,
      type,
      title: safeStr(row.title),
      subtitle: safeStr(row.subtitle) || undefined,
      imageId:
        safeStr(row.imageId) ||
        safeStr(row.mediaItemId) ||
        safeStr(row.imageUrl) ||
        undefined,
      mediaItemId:
        typeof row.mediaItemId === "string" && row.mediaItemId.trim()
          ? row.mediaItemId.trim()
          : undefined,
      imageAlt: safeStr(row.imageAlt) || undefined,
      ctaLabel: safeStr(row.ctaLabel),
      ctaHref: safeStr(row.ctaHref),
      useGradient: row.useGradient !== false,
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "hero_bleed") {
    return {
      id,
      type,
      title: safeStr(row.title),
      subtitle: safeStr(row.subtitle) || undefined,
      ctaPrimary: safeStr(row.ctaPrimary),
      ctaSecondary: safeStr(row.ctaSecondary),
      ctaPrimaryHref: safeStr(row.ctaPrimaryHref),
      ctaSecondaryHref: safeStr(row.ctaSecondaryHref),
      backgroundImageId:
        safeStr(row.backgroundImageId) ||
        safeStr(row.backgroundMediaItemId) ||
        safeStr(row.backgroundImage) ||
        undefined,
      backgroundMediaItemId:
        typeof row.backgroundMediaItemId === "string" && row.backgroundMediaItemId.trim()
          ? row.backgroundMediaItemId.trim()
          : undefined,
      overlayImageId:
        safeStr(row.overlayImageId) ||
        safeStr(row.overlayMediaItemId) ||
        safeStr(row.overlayImage) ||
        undefined,
      overlayMediaItemId:
        typeof row.overlayMediaItemId === "string" && row.overlayMediaItemId.trim()
          ? row.overlayMediaItemId.trim()
          : undefined,
      overlayImageAlt: safeStr(row.overlayImageAlt) || undefined,
      textAlign: parseTriAlign(row.textAlign, "center"),
      textPosition: parseTriAlign(row.textPosition, "center"),
      overlayPosition: parseTriAlign(row.overlayPosition, "right"),
      ...(Object.prototype.hasOwnProperty.call(row, "variant") && safeStr(row.variant) ?
        { variant: parseTriAlign(row.variant, "center") }
      : {}),
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "banner") {
    return {
      id,
      type,
      text: safeStr(row.text),
      ctaLabel: safeStr(row.ctaLabel),
      ctaHref: safeStr(row.ctaHref),
      backgroundImageId:
        safeStr(row.backgroundImageId) ||
        safeStr(row.backgroundMediaItemId) ||
        safeStr(row.backgroundImage) ||
        "",
      backgroundMediaItemId:
        typeof row.backgroundMediaItemId === "string" && row.backgroundMediaItemId.trim()
          ? row.backgroundMediaItemId.trim()
          : undefined,
      variant: "center",
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "cards") {
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items: CardRow[] = rawItems.map((raw: unknown) => {
      const r = safeObj(raw);
      return { title: safeStr(r.title), text: safeStr(r.text) };
    });
    const rawCta = Array.isArray(row.cta) ? row.cta : [];
    const cta = rawCta.map((raw: unknown) => {
      const c = safeObj(raw);
      const variant = safeStr(c.variant);
      return {
        label: safeStr(c.label),
        href: safeStr(c.href),
        ...(variant ? { variant } : {}),
      };
    });
    return {
      id,
      type,
      title: safeStr(row.title),
      text: safeStr(row.text),
      items,
      cta: cta.length ? cta : undefined,
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "zigzag") {
    const rawSteps = Array.isArray(row.steps) ? row.steps : [];
    const steps: ZigzagStep[] = rawSteps.map((raw: unknown) => {
      const s = safeObj(raw);
      return {
        step: String(s.step ?? ""),
        title: safeStr(s.title),
        text: safeStr(s.text),
        imageId:
          safeStr(s.imageId) ||
          safeStr(s.mediaItemId) ||
          safeStr(s.image) ||
          safeStr(s.src) ||
          "",
      };
    });
    return { id, type, title: safeStr(row.title), steps, ...(cfg ? { config: cfg } : {}) };
  }

  if (type === "pricing") {
    const rawPlans = Array.isArray(row.plans) ? row.plans : [];
    const plans: PricingPlanRow[] = rawPlans.map((raw: unknown) => {
      const p = safeObj(raw);
      const feats = Array.isArray(p.features) ? p.features.map((f) => (typeof f === "string" ? f : String(f))) : [];
      return {
        name: safeStr(p.name),
        price: typeof p.price === "number" ? String(p.price) : safeStr(p.price),
        featured: p.featured === true,
        features: feats,
      };
    });
    return {
      id,
      type,
      title: safeStr(row.title),
      intro: safeStr(row.intro) || safeStr(row.subtitle) || undefined,
      plans,
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "grid") {
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items: GridItemRow[] = rawItems.map((raw: unknown) => {
      const g = safeObj(raw);
      return {
        title: safeStr(g.title),
        imageId:
          safeStr(g.imageId) ||
          safeStr(g.mediaItemId) ||
          safeStr(g.image) ||
          safeStr(g.src) ||
          "",
      };
    });
    return {
      id,
      type,
      title: safeStr(row.title),
      items,
      variant: parseTriAlign(row.variant, "center"),
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "form") {
    return {
      id,
      type,
      formId: safeStr(row.formId),
      title: safeStr(row.title) || undefined,
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "relatedLinks") {
    const rawTags = Array.isArray(row.tags) ? row.tags : [];
    const tags = rawTags.map((t) => String(t ?? "").trim()).filter(Boolean);
    return {
      id,
      type,
      currentPath: safeStr(row.currentPath) || "/",
      tags: tags.length ? tags : undefined,
      title: safeStr(row.title) || undefined,
      subtitle: safeStr(row.subtitle) || undefined,
      ...(cfg ? { config: cfg } : {}),
    };
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

/** Media pick → hero / hero_full / image block (ContentWorkspace canvas). */
export function applyBlockImagePick(
  picked: { url: string; assetId?: string },
  selectedBlock: Block | null,
  setBlockById: (id: string, updater: (current: Block) => Block) => void
): void {
  if (!selectedBlock?.id) return;
  if (selectedBlock.type !== "hero" && selectedBlock.type !== "hero_full" && selectedBlock.type !== "image") return;

  const blockId = selectedBlock.id;
  setBlockById(blockId, (current) => {
    if (current.type === "hero" || current.type === "hero_full") {
      return {
        ...current,
        imageId: picked.url,
        mediaItemId: picked.assetId ?? current.mediaItemId,
      };
    }
    if (current.type === "image") {
      return {
        ...current,
        imageId: picked.url,
        mediaItemId: picked.assetId ?? current.mediaItemId,
      };
    }
    return current;
  });
}

export function duplicateBlockInWorkspaceList(
  blockId: string,
  deps: {
    setBlocks: Dispatch<SetStateAction<Block[]>>;
    setSelectedBlockId: (id: string | null) => void;
    setExpandedBlockId: (id: string | null) => void;
    queueBlockEnterAnimation: (id: string) => void;
    blockPulseTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    setBlockPulseId: Dispatch<SetStateAction<string | null>>;
  }
): void {
  let duplicatedId: string | null = null;
  deps.setBlocks((prev) => {
    const i = prev.findIndex((b) => b.id === blockId);
    if (i < 0) return prev;
    const dup = cloneBlockDeep(prev[i]!);
    duplicatedId = dup.id;
    queueMicrotask(() => {
      deps.setSelectedBlockId(dup.id);
      deps.setExpandedBlockId(dup.id);
    });
    return [...prev.slice(0, i + 1), dup, ...prev.slice(i + 1)];
  });
  if (duplicatedId) {
    deps.queueBlockEnterAnimation(duplicatedId);
    if (deps.blockPulseTimerRef.current) clearTimeout(deps.blockPulseTimerRef.current);
    deps.setBlockPulseId(duplicatedId);
    deps.blockPulseTimerRef.current = setTimeout(() => {
      deps.setBlockPulseId(null);
      deps.blockPulseTimerRef.current = null;
    }, 700);
  }
}

export function createRichTextBlockFromLegacyText(legacyBodyText: string): RichTextBlock {
  return {
    id: makeBlockId(),
    type: "richText",
    heading: "",
    body: legacyBodyText,
  };
}
