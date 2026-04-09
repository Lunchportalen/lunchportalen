/**
 * Block model helpers for ContentWorkspace: parse/serialize body, normalize blocks.
 * No React hooks; pure helpers + imperative block updates may use React types only.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { createBackofficeBlockDraft, isBackofficeBlockType } from "@/lib/cms/backofficeBlockCatalog";
import { parseBodyEnvelope, serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { parseBlockConfig } from "@/lib/cms/design/designContract";
import { safeStr, safeObj } from "./contentWorkspace.helpers";
import { getBlockEntryFlatForRender, getEntryLayersFromUnifiedRow } from "@/lib/cms/blocks/blockEntryContract";
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
  try {
    const copy = structuredClone(source) as Block;
    return { ...copy, id };
  } catch {
    return { ...(JSON.parse(JSON.stringify(source)) as Block), id };
  }
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
  const draft = createBackofficeBlockDraft(type, { id });
  return (draft ?? { id, type: "divider" as const }) as Block;
}

export function isAddModalBlockTypeFromOverlay(type: string): type is BlockType {
  return isBackofficeBlockType(type);
}

export function blockTypeSubtitle(type: BlockType, block?: Block): string {
  if (block && block.type === type) {
    switch (block.type) {
      case "hero": {
        const flat = getBlockEntryFlatForRender(block);
        const bits = [
          String(flat.title ?? "").trim() ? "Har tittel" : "Mangler tittel",
          String(flat.imageId ?? "").trim() ? "Har bilde" : "Mangler bilde",
          String(flat.ctaLabel ?? "").trim() ? "Har CTA" : "Uten CTA",
        ];
        return bits.join(" · ");
      }
      case "hero_full": {
        const flat = getBlockEntryFlatForRender(block);
        const bits = [
          String(flat.title ?? "").trim() ? "Har tittel" : "Mangler tittel",
          String(flat.imageId ?? "").trim() ? "Har bilde" : "Mangler bilde",
          flat.useGradient === false ? "Flat overlay" : "Gradient-overlay",
        ];
        return bits.join(" · ");
      }
      case "hero_bleed": {
        const flat = getBlockEntryFlatForRender(block);
        const bits = [
          String(flat.backgroundImageId ?? "").trim() ? "Bakgrunn OK" : "Mangler bakgrunn",
          String(flat.ctaPrimary ?? "").trim() ? "Primær CTA" : "Uten primær CTA",
          String(flat.ctaSecondary ?? "").trim() ? "Sekundær CTA" : null,
          String(flat.variant ?? "").trim() || `Tekstjustering: ${String(flat.textAlign ?? "center")}`,
        ].filter(Boolean) as string[];
        return bits.join(" · ");
      }
      case "banner":
        return [
          (block.text || "").trim() ? "Har budskap" : "Mangler tekst",
          (block.ctaLabel || "").trim() ? "Har CTA" : "Uten CTA",
          (block.backgroundImageId || "").trim() ? "Har bakgrunn" : "Mangler bilde",
        ].join(" · ");
      case "richText":
        return [
          (block.heading || "").trim() ? "Har overskrift" : "Uten overskrift",
          (block.body || "").trim() ? "Har brødtekst" : "Tom brødtekst",
        ].join(" · ");
      case "image":
        return [
          (block.imageId || "").trim() ? "Kilde satt" : "Mangler bilde",
          (block.alt || "").trim() ? "Har alt" : "Uten alt-tekst",
        ].join(" · ");
      case "cta": {
        const flat = getBlockEntryFlatForRender(block);
        return [
          String(flat.buttonLabel ?? "").trim() ? "Primær knapp" : "Mangler primær",
          String(flat.secondaryButtonLabel ?? "").trim() ? "Sekundær knapp" : "Uten sekundær",
          String(flat.body ?? "").trim() ? "Har støttetekst" : "Uten støttetekst",
        ].join(" · ");
      }
      case "divider":
        return block.style === "space" ? "Luft mellom seksjoner" : "Tynn skillelinje";
      case "cards": {
        const flat = getBlockEntryFlatForRender(block);
        const items = Array.isArray(flat.items) ? flat.items : [];
        const n = items.length;
        const filled = items.filter(
          (it: unknown) =>
            String(safeObj(it).title ?? "").trim() && String(safeObj(it).text ?? "").trim(),
        ).length;
        const pres = flat.presentation === "plain" ? "Rolige kort" : "Ikonkort";
        return `${n} kort · ${filled} komplette · ${pres} · ${String(flat.text ?? "").trim() ? "Har ingress" : "Uten ingress"}`;
      }
      case "zigzag": {
        const flat = getBlockEntryFlatForRender(block);
        const steps = Array.isArray(flat.steps) ? flat.steps : [];
        const n = steps.length;
        const mode = flat.presentation === "faq" ? "Spørsmål/svar" : "Prosess";
        return `${n} steg · ${mode} · ${String(flat.intro ?? "").trim() ? "Har ingress" : "Uten ingress"}`;
      }
      case "pricing": {
        const flat = getBlockEntryFlatForRender(block);
        const plans = Array.isArray(flat.plans) ? flat.plans : [];
        const n = plans.length;
        const feat = plans.filter((p: unknown) => safeObj(p).featured === true).length;
        const ctaN = plans.filter(
          (p: unknown) =>
            String(safeObj(p).ctaLabel ?? "").trim() && String(safeObj(p).ctaHref ?? "").trim(),
        ).length;
        if (n === 0) return "Live priser (ingen manuelle pakker)";
        return `${n} plan${n === 1 ? "" : "er"} · ${feat} fremhevet · ${ctaN} med CTA`;
      }
      case "grid": {
        const flat = getBlockEntryFlatForRender(block);
        const items = Array.isArray(flat.items) ? flat.items : [];
        const n = items.length;
        const sub = items.filter((it: unknown) => String(safeObj(it).subtitle ?? "").trim()).length;
        const meta = items.filter((it: unknown) => String(safeObj(it).metaLine ?? "").trim()).length;
        return `${n} celler · undertittel ${sub}/${n} · meta ${meta}/${n} · variant ${String(flat.variant || "center").trim()}`;
      }
      case "form":
        return (block.formId || "").trim() ? `Skjema-ID ${(block.formId || "").trim()}` : "Mangler skjema-ID";
      case "relatedLinks": {
        const flat = getBlockEntryFlatForRender(block);
        const tags = Array.isArray(flat.tags) ? flat.tags : [];
        const n = tags.length;
        const max = flat.maxSuggestions;
        return [
          `${n} stikkord`,
          max != null ? `maks ${max}` : "maks standard",
          String(flat.subtitle ?? "").trim() ? "Har ingress" : "Uten ingress",
          String(flat.emptyFallbackText ?? "").trim() ? "Egen tomtilstand" : "Standard tomtilstand",
        ].join(" · ");
      }
    }
  }
  switch (type) {
    case "hero":
      return "Hero · tittel, bilde og CTA";
    case "hero_full":
      return "Hero full bredde";
    case "hero_bleed":
      return "Hero kant til kant";
    case "banner":
      return "Bannerstripe";
    case "richText":
      return "Tekstseksjon";
    case "image":
      return "Bilde";
    case "cta":
      return "Handlingsseksjon";
    case "divider":
      return "Skille";
    case "cards":
      return "Kortseksjon";
    case "zigzag":
      return "Steg eller FAQ";
    case "pricing":
      return "Prisblokk";
    case "grid":
      return "Rutenett / lokasjoner";
    case "form":
      return "Skjemablokk";
    case "relatedLinks":
      return "Relaterte sider";
    default:
      return "Innhold";
  }
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
    const { contentData: cd, settingsData: _sd } = getEntryLayersFromUnifiedRow("hero", row);
    return {
      id,
      type,
      contentData: {
        title: safeStr(cd.title),
        subtitle: safeStr(cd.subtitle) || undefined,
        imageId:
          safeStr(cd.imageId) ||
          safeStr(cd.mediaItemId) ||
          safeStr(cd.imageUrl) ||
          undefined,
        mediaItemId:
          typeof cd.mediaItemId === "string" && cd.mediaItemId.trim() ? cd.mediaItemId.trim() : undefined,
        imageAlt: safeStr(cd.imageAlt) || undefined,
        ctaLabel: safeStr(cd.ctaLabel),
        ctaHref: safeStr(cd.ctaHref),
      },
      settingsData: {},
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
    const { contentData: cd, settingsData: _s, structureData: st } = getEntryLayersFromUnifiedRow("cta", row);
    return {
      id,
      type,
      contentData: {
        eyebrow: safeStr(cd.eyebrow) || undefined,
        title: safeStr(cd.title),
        body: safeStr(cd.body),
      },
      settingsData: {},
      structureData: {
        buttonLabel: safeStr(st.buttonLabel),
        buttonHref: safeStr(st.buttonHref),
        secondaryButtonLabel: safeStr(st.secondaryButtonLabel) || undefined,
        secondaryButtonHref: safeStr(st.secondaryButtonHref) || undefined,
      },
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "divider") {
    const style = safeStr(row.style) === "space" ? "space" : undefined;
    return { id, type, ...(style ? ({ style } as const) : {}), ...(cfg ? { config: cfg } : {}) };
  }

  if (type === "hero_full") {
    const { contentData: cd, settingsData: sd } = getEntryLayersFromUnifiedRow("hero_full", row);
    return {
      id,
      type,
      contentData: {
        title: safeStr(cd.title),
        subtitle: safeStr(cd.subtitle) || undefined,
        imageId:
          safeStr(cd.imageId) ||
          safeStr(cd.mediaItemId) ||
          safeStr(cd.imageUrl) ||
          undefined,
        mediaItemId:
          typeof cd.mediaItemId === "string" && cd.mediaItemId.trim() ? cd.mediaItemId.trim() : undefined,
        imageAlt: safeStr(cd.imageAlt) || undefined,
        ctaLabel: safeStr(cd.ctaLabel),
        ctaHref: safeStr(cd.ctaHref),
      },
      settingsData: { useGradient: sd.useGradient !== false },
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "hero_bleed") {
    const { contentData: cd, settingsData: sd } = getEntryLayersFromUnifiedRow("hero_bleed", row);
    return {
      id,
      type,
      contentData: {
        title: safeStr(cd.title),
        subtitle: safeStr(cd.subtitle) || undefined,
        ctaPrimary: safeStr(cd.ctaPrimary),
        ctaSecondary: safeStr(cd.ctaSecondary),
        ctaPrimaryHref: safeStr(cd.ctaPrimaryHref),
        ...(cd.ctaPrimaryHrefKind === "internal" || cd.ctaPrimaryHrefKind === "external"
          ? { ctaPrimaryHrefKind: cd.ctaPrimaryHrefKind }
          : {}),
        ctaSecondaryHref: safeStr(cd.ctaSecondaryHref),
        backgroundImageId:
          safeStr(cd.backgroundImageId) ||
          safeStr(cd.backgroundMediaItemId) ||
          safeStr(cd.backgroundImage) ||
          undefined,
        backgroundMediaItemId:
          typeof cd.backgroundMediaItemId === "string" && cd.backgroundMediaItemId.trim()
            ? cd.backgroundMediaItemId.trim()
            : undefined,
        overlayImageId:
          safeStr(cd.overlayImageId) ||
          safeStr(cd.overlayMediaItemId) ||
          safeStr(cd.overlayImage) ||
          undefined,
        overlayMediaItemId:
          typeof cd.overlayMediaItemId === "string" && cd.overlayMediaItemId.trim()
            ? cd.overlayMediaItemId.trim()
            : undefined,
        overlayImageAlt: safeStr(cd.overlayImageAlt) || undefined,
      },
      settingsData: {
        textAlign: parseTriAlign(sd.textAlign, "center"),
        textPosition: parseTriAlign(sd.textPosition, "center"),
        overlayPosition: parseTriAlign(sd.overlayPosition, "right"),
        ...(Object.prototype.hasOwnProperty.call(sd, "variant") && safeStr(sd.variant) ?
          { variant: parseTriAlign(sd.variant, "center") }
        : {}),
      },
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
    const { contentData: cd, settingsData: sd, structureData: st } = getEntryLayersFromUnifiedRow("cards", row);
    const rawItems = Array.isArray(st.items) ? st.items : [];
    const items: CardRow[] = rawItems.map((raw: unknown) => {
      const r = safeObj(raw);
      const kicker = safeStr(r.kicker);
      const linkLabel = safeStr(r.linkLabel);
      const linkHref = safeStr(r.linkHref);
      return {
        title: safeStr(r.title),
        text: safeStr(r.text),
        ...(kicker ? { kicker } : {}),
        ...(linkLabel || linkHref ? { ...(linkLabel ? { linkLabel } : {}), ...(linkHref ? { linkHref } : {}) } : {}),
      };
    });
    const rawCta = Array.isArray(st.cta) ? st.cta : [];
    const cta = rawCta
      .map((raw: unknown) => {
        const c = safeObj(raw);
        const variant = safeStr(c.variant);
        return {
          label: safeStr(c.label),
          href: safeStr(c.href),
          ...(variant ? { variant } : {}),
        };
      })
      .filter((c) => c.label.trim() || c.href.trim());
    const pres = safeStr(sd.presentation).toLowerCase();
    const presentation = pres === "plain" ? "plain" : pres === "feature" ? "feature" : undefined;
    return {
      id,
      type,
      contentData: { title: safeStr(cd.title), text: safeStr(cd.text) },
      settingsData: { ...(presentation ? { presentation } : {}) },
      structureData: { items, ...(cta.length ? { cta } : {}) },
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "zigzag") {
    const { contentData: cd, settingsData: sd, structureData: st } = getEntryLayersFromUnifiedRow("zigzag", row);
    const rawSteps = Array.isArray(st.steps) ? st.steps : [];
    const steps: ZigzagStep[] = rawSteps.map((raw: unknown) => {
      const s = safeObj(raw);
      const kicker = safeStr(s.kicker);
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
        ...(kicker ? { kicker } : {}),
      };
    });
    const intro = safeStr(cd.intro) || undefined;
    const zp = safeStr(sd.presentation).toLowerCase();
    const presentation = zp === "faq" ? "faq" : zp === "process" ? "process" : undefined;
    return {
      id,
      type,
      contentData: { title: safeStr(cd.title), ...(intro ? { intro } : {}) },
      settingsData: { ...(presentation ? { presentation } : {}) },
      structureData: { steps },
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "pricing") {
    const { contentData: cd, settingsData: _sd, structureData: st } = getEntryLayersFromUnifiedRow("pricing", row);
    const rawPlans = Array.isArray(st.plans) ? st.plans : [];
    const plans: PricingPlanRow[] = rawPlans.map((raw: unknown) => {
      const p = safeObj(raw);
      const feats = Array.isArray(p.features) ? p.features.map((f) => (typeof f === "string" ? f : String(f))) : [];
      const tagline = safeStr(p.tagline) || safeStr(p.headline) || undefined;
      const badge = safeStr(p.badge) || undefined;
      const period = safeStr(p.period) || undefined;
      const ctaLabel = safeStr(p.ctaLabel) || undefined;
      const ctaHref = safeStr(p.ctaHref) || undefined;
      return {
        name: safeStr(p.name),
        ...(tagline ? { tagline } : {}),
        ...(badge ? { badge } : {}),
        price: typeof p.price === "number" ? String(p.price) : safeStr(p.price),
        ...(period ? { period } : {}),
        featured: p.featured === true,
        features: feats,
        ...(ctaLabel ? { ctaLabel } : {}),
        ...(ctaHref ? { ctaHref } : {}),
      };
    });
    const footnote = safeStr(cd.footnote) || undefined;
    return {
      id,
      type,
      contentData: {
        title: safeStr(cd.title),
        intro: safeStr(cd.intro) || safeStr(cd.subtitle) || undefined,
        ...(footnote ? { footnote } : {}),
      },
      settingsData: {},
      structureData: { plans },
      ...(cfg ? { config: cfg } : {}),
    };
  }

  if (type === "grid") {
    const { contentData: cd, settingsData: sd, structureData: st } = getEntryLayersFromUnifiedRow("grid", row);
    const rawItems = Array.isArray(st.items) ? st.items : [];
    const items: GridItemRow[] = rawItems.map((raw: unknown) => {
      const g = safeObj(raw);
      const subtitle = safeStr(g.subtitle) || undefined;
      const metaLine = safeStr(g.metaLine) || undefined;
      return {
        title: safeStr(g.title),
        imageId:
          safeStr(g.imageId) ||
          safeStr(g.mediaItemId) ||
          safeStr(g.image) ||
          safeStr(g.src) ||
          "",
        ...(subtitle ? { subtitle } : {}),
        ...(metaLine ? { metaLine } : {}),
      };
    });
    const intro = safeStr(cd.intro) || undefined;
    return {
      id,
      type,
      contentData: { title: safeStr(cd.title), ...(intro ? { intro } : {}) },
      settingsData: { variant: parseTriAlign(sd.variant, "center") },
      structureData: { items },
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
    const { contentData: cd, settingsData: sd, structureData: st } = getEntryLayersFromUnifiedRow("relatedLinks", row);
    const rawTags = Array.isArray(st.tags) ? st.tags : [];
    const tags = rawTags.map((t) => String(t ?? "").trim()).filter(Boolean);
    const emptyFallbackText = safeStr(cd.emptyFallbackText) || undefined;
    let maxSuggestions: number | undefined;
    if (typeof sd.maxSuggestions === "number" && Number.isFinite(sd.maxSuggestions)) {
      const n = Math.round(sd.maxSuggestions);
      if (n >= 1 && n <= 12) maxSuggestions = n;
    }
    return {
      id,
      type,
      contentData: {
        title: safeStr(cd.title) || undefined,
        subtitle: safeStr(cd.subtitle) || undefined,
        ...(emptyFallbackText ? { emptyFallbackText } : {}),
      },
      settingsData: {
        currentPath: safeStr(sd.currentPath) || "/",
        ...(maxSuggestions != null ? { maxSuggestions } : {}),
      },
      structureData: { tags },
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

/**
 * Canonical body payload for dirty/save snapshot comparison — same shape as `bodyForSave`
 * (inner blocks JSON string, or envelope object when documentType is set).
 */
export function snapshotBodyFromPageBody(pageBody: unknown): string | Record<string, unknown> {
  const envelope = parseBodyEnvelope(pageBody);
  const parsedBody = parseBodyToBlocks(envelope.blocksBody);
  const blocksBodyStr = deriveBodyFromParse(parsedBody);
  if (envelope.documentType != null) {
    return serializeBodyEnvelope({
      documentType: envelope.documentType,
      invariantFields: envelope.invariantFields,
      cultureFields: envelope.cultureFields,
      blocksBody: blocksBodyStr,
    }) as Record<string, unknown>;
  }
  return blocksBodyStr;
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
        contentData: {
          ...current.contentData,
          imageId: picked.url,
          mediaItemId: picked.assetId ?? current.contentData.mediaItemId,
        },
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
