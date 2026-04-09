/**
 * Normalizes AI page-builder API response blocks into editor Block shape.
 * Used when applying page-builder result in ContentWorkspace.
 * Keeps logic in app tree to avoid lib/ cursorignore.
 *
 * Content-generation contract: generated blocks (page-builder, block-builder, screenshot-builder)
 * must pass through these normalizers before apply. Apply only when result is non-empty;
 * malformed or unknown-type blocks are dropped or mapped to supported types. Never persist
 * raw generator output without normalization.
 */

export const PAGE_BUILDER_SUPPORTED_TYPES = [
  "hero",
  "hero_full",
  "hero_bleed",
  "banner",
  "richText",
  "cta",
  "image",
  "divider",
  "cards",
  "zigzag",
  "pricing",
  "grid",
  "relatedLinks",
] as const;

export type PageBuilderSupportedType = (typeof PAGE_BUILDER_SUPPORTED_TYPES)[number];

export type RawPageBuilderBlock = { type?: string; data?: Record<string, unknown>; id?: string };

function makeBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `blk_${crypto.randomUUID()}`;
  }
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v ?? "").trim() : "";
}

function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function mapToSupportedType(type: string): PageBuilderSupportedType {
  const t = type?.trim().toLowerCase() ?? "";
  if (PAGE_BUILDER_SUPPORTED_TYPES.includes(t as PageBuilderSupportedType)) return t as PageBuilderSupportedType;
  const aliasMap: Record<string, PageBuilderSupportedType> = {
    valueprops: "richText", value_props: "richText", valueprops3: "richText",
    benefits: "richText", proof: "richText", testimonials: "richText", trust: "richText",
    ctaband: "cta", cta_band: "cta", call_to_action: "cta",
    separator: "divider", spacer: "divider",
    banners: "banner",
    code: "richText",
    windows: "richText",
  };
  return aliasMap[t] ?? "richText";
}

/** Editor Block-like shape (id + type + flat data for hero, richText, cta, etc.). */
export type NormalizedEditorBlock = {
  id: string;
  type: PageBuilderSupportedType;
  data: Record<string, unknown>;
};

function defaultsForType(type: PageBuilderSupportedType): Record<string, unknown> {
  switch (type) {
    case "hero": return { title: "", subtitle: "", imageId: "", imageAlt: "", ctaLabel: "", ctaHref: "" };
    case "hero_full":
      return { title: "", subtitle: "", imageId: "", imageAlt: "", ctaLabel: "", ctaHref: "", useGradient: true };
    case "richText": return { heading: "", body: "" };
    case "cta":
      return {
        eyebrow: "",
        title: "",
        body: "",
        buttonLabel: "",
        buttonHref: "",
        secondaryButtonLabel: "",
        secondaryButtonHref: "",
      };
    case "image": return { imageId: "", alt: "", caption: "" };
    case "divider": return {};
    case "cards":
      return {
        title: "",
        text: "",
        presentation: "feature",
        items: [
          { title: "", text: "" },
          { title: "", text: "" },
          { title: "", text: "" },
        ],
        cta: [],
      };
    case "zigzag":
      return {
        title: "",
        intro: "",
        presentation: "process",
        steps: [
          { step: "1", title: "", text: "", imageId: "" },
          { step: "2", title: "", text: "", imageId: "" },
        ],
      };
    case "pricing":
      return { title: "To nivå – tydelig avtale", intro: "", footnote: "", plans: [] };
    case "banner":
      return {
        text: "",
        ctaLabel: "",
        ctaHref: "",
        backgroundImageId: "",
        variant: "center",
      };
    case "grid":
      return {
        title: "",
        intro: "",
        variant: "center",
        items: [
          { title: "", imageId: "" },
          { title: "", imageId: "" },
          { title: "", imageId: "" },
        ],
      };
    case "relatedLinks":
      return { currentPath: "/", tags: [], title: "", subtitle: "", maxSuggestions: 8, emptyFallbackText: "" };
    case "hero_bleed":
      return {
        title: "",
        subtitle: "",
        ctaPrimary: "",
        ctaSecondary: "",
        ctaPrimaryHref: "",
        ctaSecondaryHref: "",
        backgroundImageId: "",
        overlayImageId: "",
        overlayImageAlt: "",
        variant: "center",
        textAlign: "center",
        textPosition: "center",
        overlayPosition: "center",
      };
    default: return { heading: "", body: "" };
  }
}

/**
 * Clear mediaItemId when URL/assetPath is missing so we never persist stale media refs.
 */
function clearStaleMediaRef(
  type: PageBuilderSupportedType,
  out: Record<string, unknown>
): void {
  if (type === "hero" || type === "hero_full") {
    const ref = safeStr(out.imageId);
    if (out.mediaItemId != null && !ref) delete out.mediaItemId;
  } else if (type === "hero_bleed") {
    const bg = safeStr(out.backgroundImageId);
    const ov = safeStr(out.overlayImageId);
    if (out.backgroundMediaItemId != null && !bg) delete out.backgroundMediaItemId;
    if (out.overlayMediaItemId != null && !ov) delete out.overlayMediaItemId;
  } else if (type === "banner") {
    const bg = safeStr(out.backgroundImageId);
    if (out.backgroundMediaItemId != null && !bg) delete out.backgroundMediaItemId;
  } else if (type === "image") {
    const ref = safeStr(out.imageId);
    if (out.mediaItemId != null && !ref) delete out.mediaItemId;
  }
}

function sanitizeData(type: PageBuilderSupportedType, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaultsForType(type) };
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (key === "items" && (type === "cards" || type === "zigzag" || type === "grid") && Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "object" && item && !Array.isArray(item) ? safeObj(item) : {}));
    } else if (key === "steps" && type === "zigzag" && Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "object" && item && !Array.isArray(item) ? safeObj(item) : {}));
    } else if (key === "plans" && type === "pricing" && Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "object" && item && !Array.isArray(item) ? safeObj(item) : {}));
    } else if (key === "cta" && type === "cards" && Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "object" && item && !Array.isArray(item) ? safeObj(item) : {}));
    } else if (key === "tags" && type === "relatedLinks" && Array.isArray(value)) {
      out[key] = value.map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : "")).filter(Boolean);
    }
  }
  clearStaleMediaRef(type, out);
  return out;
}

export type NormalizeResult = { blocks: NormalizedEditorBlock[]; warnings: string[] };

export function normalizePageBuilderBlocks(rawBlocks: unknown): NormalizeResult {
  const warnings: string[] = [];
  const source = Array.isArray(rawBlocks) ? rawBlocks : [];
  const blocks: NormalizedEditorBlock[] = [];
  for (let i = 0; i < source.length; i++) {
    const obj = safeObj(source[i]);
    const rawType = safeStr(obj.type) || "richText";
    const mappedType = mapToSupportedType(rawType);
    if (rawType && mappedType !== rawType) warnings.push(`Blokk ${i + 1}: "${rawType}" → "${mappedType}".`);
    const id = safeStr(obj.id) || makeBlockId();
    const data = sanitizeData(mappedType, safeObj(obj.data));
    blocks.push({ id, type: mappedType, data });
  }
  return { blocks, warnings };
}

/**
 * Normalize a single block from AI Block Builder API ({ id?, type?, data? }) to editor-safe shape.
 * Used when applying block-builder result in ContentWorkspace.
 */
export function normalizeSingleBlockBuilderBlock(raw: unknown): NormalizedEditorBlock | null {
  const obj = safeObj(raw);
  const rawType = safeStr(obj.type) || "richText";
  const mappedType = mapToSupportedType(rawType);
  const id = safeStr(obj.id) || makeBlockId();
  const data = sanitizeData(mappedType, safeObj(obj.data));
  return { id, type: mappedType, data };
}
