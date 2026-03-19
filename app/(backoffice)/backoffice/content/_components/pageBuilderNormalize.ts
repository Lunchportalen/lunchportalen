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
  "richText",
  "cta",
  "image",
  "divider",
  "banners",
  "code",
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
    case "hero": return { title: "", subtitle: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "" };
    case "richText": return { heading: "", body: "" };
    case "cta": return { title: "", body: "", buttonLabel: "", buttonHref: "" };
    case "image": return { assetPath: "", alt: "", caption: "" };
    case "divider": return {};
    case "banners": return { items: [] };
    case "code": return { code: "", displayIntro: false, displayOutro: false };
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
  if (type === "hero") {
    const url = safeStr(out.imageUrl);
    if (out.mediaItemId != null && !url) delete out.mediaItemId;
  } else if (type === "image") {
    const path = safeStr(out.assetPath);
    if (out.mediaItemId != null && !path) delete out.mediaItemId;
  }
}

function sanitizeData(type: PageBuilderSupportedType, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaultsForType(type) };
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (key === "items" && type === "banners" && Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "object" && item && !Array.isArray(item) ? safeObj(item) : {}));
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
