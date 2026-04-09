/**
 * CMS design contract: themes/layouts/card presets are the ONLY allowed design switches on blocks.
 * Visual execution is token-based (lp-* + --lp-*) in globals.css — never in block `data`.
 */

export type BlockTheme = "default" | "dark" | "highlight";

export type BlockLayout = "standard" | "full" | "split";

export type CardVariant = "default" | "glass" | "elevated" | "flat";

export type CardHover = "none" | "lift" | "glow";

export type CardConfig = {
  variant?: CardVariant;
  hover?: CardHover;
};

/** Section surface token (marketing sections). */
export type SectionSurfaceToken = "default" | "alt" | "contrast";

/** Vertical rhythm for `.lp-section*`. */
export type SectionSpacingToken = "tight" | "normal" | "wide";

export type TypographyHeadingToken = "default" | "display";

export type TypographyBodyToken = "default" | "compact";

/** Horizontal width for `.lp-container*` + shell alignment. */
export type ContainerWidthToken = "normal" | "wide" | "full";

export type SurfaceSectionConfig = {
  section?: SectionSurfaceToken;
};

export type SpacingSectionConfig = {
  section?: SectionSpacingToken;
};

export type TypographyConfig = {
  heading?: TypographyHeadingToken;
  body?: TypographyBodyToken;
};

export type BlockConfig = {
  theme?: BlockTheme;
  layout?: BlockLayout;
  card?: CardConfig;
  /** Container width; separate from `layout` (hero full-bleed). */
  container?: ContainerWidthToken;
  surface?: SurfaceSectionConfig;
  spacing?: SpacingSectionConfig;
  typography?: TypographyConfig;
  /**
   * Optional slice/section id: resolves `meta.sectionDesign[sectionId]` before block `config`.
   * Persisted only in block `config` — not in freeform CSS.
   */
  sectionId?: string;
};

export type MergedCardConfig = Required<CardConfig>;

/**
 * Global card/hover control stored in `global_content` key `settings`, under `data.designSettings`.
 * Shape matches CMS document; `card.default` applies to all block types unless overridden per type.
 */
export type DesignSettingsDocument = {
  card?: Record<string, CardConfig | Record<string, unknown>>;
  surface?: Record<string, unknown>;
  spacing?: Record<string, unknown>;
  typography?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

export type ParsedSurfaceSettings = {
  section: SectionSurfaceToken;
};

export type ParsedSpacingSettings = {
  section: SectionSpacingToken;
};

export type ParsedTypographySettings = {
  heading: TypographyHeadingToken;
  body: TypographyBodyToken;
};

export type ParsedLayoutSettings = {
  container: ContainerWidthToken;
};

/** Parsed global design (published `settings.data.designSettings`). */
export type ParsedDesignSettings = {
  card: Partial<Record<string, CardConfig>>;
  surface: ParsedSurfaceSettings;
  spacing: ParsedSpacingSettings;
  typography: ParsedTypographySettings;
  layout: ParsedLayoutSettings;
};

/** Keys exposed in CMS global design UI (`designSettings.card.<key>`). `default` applies before per-type overrides. */
export const DESIGN_SETTINGS_CARD_BLOCK_KEYS = [
  "default",
  "hero",
  "richText",
  "cta",
  "image",
  "cards",
  "pricing",
  "form",
] as const;

export type DesignSettingsCardBlockKey = (typeof DESIGN_SETTINGS_CARD_BLOCK_KEYS)[number];

/** When block.config.card omits fields, these presets preserve today’s marketing look per block type. */
export const BLOCK_CARD_PRESETS: Partial<Record<string, MergedCardConfig>> = {
  hero: { variant: "default", hover: "lift" },
  richText: { variant: "glass", hover: "none" },
  cta: { variant: "default", hover: "none" },
  image: { variant: "glass", hover: "none" },
  cards: { variant: "default", hover: "lift" },
  pricing: { variant: "default", hover: "lift" },
  form: { variant: "default", hover: "none" },
};

/** Keys AI / editors must never persist as design in `data` (structure + copy only). */
export const FORBIDDEN_BLOCK_DATA_DESIGN_KEYS = new Set([
  "color",
  "backgroundColor",
  "padding",
  "margin",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "border",
  "borderRadius",
  "boxShadow",
  "width",
  "height",
  "zIndex",
  "style",
  "className",
  "tailwind",
]);

export type DesignConfig = {
  themes: Record<
    BlockTheme,
    {
      /** lp-* class fragments applied by render layer (no raw colors/spacing values). */
      sectionModifiers: string[];
      description: string;
    }
  >;
  layouts: Record<
    BlockLayout,
    {
      heroModifiers: string[];
      description: string;
    }
  >;
};

/** Single source for AI + render: maps config → existing lp-* primitives only. */
export const DESIGN_CONFIG: DesignConfig = {
  themes: {
    default: { sectionModifiers: [], description: "Base surface; section rhythm from .lp-section." },
    dark: {
      sectionModifiers: ["lp-bg-muted"],
      description: "Muted surface token; still uses shared typography tokens.",
    },
    highlight: {
      sectionModifiers: ["alt"],
      description: "Alternating marketing section (pairs with .lp-section).",
    },
  },
  layouts: {
    standard: { heroModifiers: [], description: "Hero respects container; no full-bleed." },
    full: {
      heroModifiers: ["lp-fullbleed", "lp-hero--layout-full"],
      description: "Edge-to-edge media; min height from .lp-hero--layout-full in globals.",
    },
    split: {
      heroModifiers: ["lp-heroSplit"],
      description: "Reserved: split hero grid; falls back to standard until content supplies split copy.",
    },
  },
};

function parseCardConfig(raw: unknown): CardConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const variant =
    o.variant === "default" ||
    o.variant === "glass" ||
    o.variant === "elevated" ||
    o.variant === "flat"
      ? (o.variant as CardVariant)
      : undefined;
  const hover =
    o.hover === "none" || o.hover === "lift" || o.hover === "glow" ? (o.hover as CardHover) : undefined;
  if (!variant && !hover) return undefined;
  return { ...(variant ? { variant } : {}), ...(hover ? { hover } : {}) };
}

/** Parse `designSettings.surface` or block `config.surface`. */
export function parseSurfaceConfig(raw: unknown): Partial<ParsedSurfaceSettings> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const section =
    o.section === "default" || o.section === "alt" || o.section === "contrast"
      ? (o.section as SectionSurfaceToken)
      : undefined;
  return section ? { section } : {};
}

/** Parse `designSettings.spacing` or block `config.spacing`. */
export function parseSpacingConfig(raw: unknown): Partial<ParsedSpacingSettings> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const section =
    o.section === "tight" || o.section === "normal" || o.section === "wide"
      ? (o.section as SectionSpacingToken)
      : undefined;
  return section ? { section } : {};
}

/** Parse `designSettings.typography` or block `config.typography`. */
export function parseTypographyConfig(raw: unknown): Partial<ParsedTypographySettings> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const heading =
    o.heading === "default" || o.heading === "display" ? (o.heading as TypographyHeadingToken) : undefined;
  const body = o.body === "default" || o.body === "compact" ? (o.body as TypographyBodyToken) : undefined;
  const out: Partial<ParsedTypographySettings> = {};
  if (heading) out.heading = heading;
  if (body) out.body = body;
  return out;
}

/** Parse `designSettings.layout` (global) or block `container` (width only). */
export function parseLayoutConfig(raw: unknown): Partial<ParsedLayoutSettings> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const container =
    o.container === "normal" || o.container === "wide" || o.container === "full"
      ? (o.container as ContainerWidthToken)
      : undefined;
  return container ? { container } : {};
}

export function parseBlockConfig(raw: unknown): BlockConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const theme =
    o.theme === "default" || o.theme === "dark" || o.theme === "highlight" ? (o.theme as BlockTheme) : undefined;
  const layout =
    o.layout === "standard" || o.layout === "full" || o.layout === "split"
      ? (o.layout as BlockLayout)
      : undefined;
  const card = parseCardConfig(o.card);
  const container =
    o.container === "normal" || o.container === "wide" || o.container === "full"
      ? (o.container as ContainerWidthToken)
      : undefined;
  const surface = parseSurfaceConfig(o.surface);
  const spacing = parseSpacingConfig(o.spacing);
  const typography = parseTypographyConfig(o.typography);
  const sectionId =
    typeof o.sectionId === "string" && o.sectionId.trim() ? o.sectionId.trim() : undefined;
  const hasSurface = surface.section !== undefined;
  const hasSpacing = spacing.section !== undefined;
  const hasTypo = typography.heading !== undefined || typography.body !== undefined;
  if (
    !theme &&
    !layout &&
    !card &&
    !container &&
    !hasSurface &&
    !hasSpacing &&
    !hasTypo &&
    !sectionId
  ) {
    return undefined;
  }
  return {
    ...(theme ? { theme } : {}),
    ...(layout ? { layout } : {}),
    ...(card ? { card } : {}),
    ...(container ? { container } : {}),
    ...(hasSurface ? { surface: { section: surface.section } } : {}),
    ...(hasSpacing ? { spacing: { section: spacing.section } } : {}),
    ...(hasTypo ? { typography: { ...typography } } : {}),
    ...(sectionId ? { sectionId } : {}),
  };
}

export type MergedBlockDesign = {
  theme: BlockTheme;
  layout: BlockLayout;
  /** Partial card overrides from persisted config (may be empty). */
  card: CardConfig | undefined;
};

export function mergeBlockConfig(config?: BlockConfig | null): MergedBlockDesign {
  const theme: BlockTheme =
    config?.theme === "dark" || config?.theme === "highlight" ? config.theme : "default";
  const layout: BlockLayout =
    config?.layout === "full" || config?.layout === "split" || config?.layout === "standard"
      ? config.layout
      : "standard";
  const card =
    config?.card != null && typeof config.card === "object" ? parseCardConfig(config.card) : undefined;
  return { theme, layout, card };
}

const DEFAULT_PARSED_SURFACE: ParsedSurfaceSettings = { section: "default" };
const DEFAULT_PARSED_SPACING: ParsedSpacingSettings = { section: "normal" };
const DEFAULT_PARSED_TYPO: ParsedTypographySettings = { heading: "default", body: "default" };
const DEFAULT_PARSED_LAYOUT: ParsedLayoutSettings = { container: "normal" };

/**
 * Fully merged design for a block: global designSettings → block.config override.
 * `heroLayout` is block `config.layout` (full-bleed hero, etc.). `container` is horizontal width.
 */
export type MergedDesign = {
  theme: BlockTheme;
  heroLayout: BlockLayout;
  card: CardConfig | undefined;
  surface: ParsedSurfaceSettings;
  spacing: ParsedSpacingSettings;
  typography: ParsedTypographySettings;
  container: ParsedLayoutSettings;
};

export function mergeFullDesign(
  config: BlockConfig | null | undefined,
  designSettings: ParsedDesignSettings | null | undefined,
  _blockType: string,
): MergedDesign {
  void _blockType;
  const base = mergeBlockConfig(config);
  const g = designSettings;
  const gSurface = g?.surface ?? DEFAULT_PARSED_SURFACE;
  const gSpacing = g?.spacing ?? DEFAULT_PARSED_SPACING;
  const gTypo = g?.typography ?? DEFAULT_PARSED_TYPO;
  const gLayout = g?.layout ?? DEFAULT_PARSED_LAYOUT;

  const bSurface = parseSurfaceConfig(config?.surface);
  const bSpacing = parseSpacingConfig(config?.spacing);
  const bTypo = parseTypographyConfig(config?.typography);
  const bLayoutFromContainer =
    config?.container === "normal" || config?.container === "wide" || config?.container === "full"
      ? { container: config.container }
      : {};

  return {
    theme: base.theme,
    heroLayout: base.layout,
    card: base.card,
    surface: { section: bSurface.section ?? gSurface.section },
    spacing: { section: bSpacing.section ?? gSpacing.section },
    typography: {
      heading: bTypo.heading ?? gTypo.heading,
      body: bTypo.body ?? gTypo.body,
    },
    container: {
      container: bLayoutFromContainer.container ?? gLayout.container,
    },
  };
}

/** Section vertical spacing token → base section class (before surface/theme). */
export function sectionSpacingBaseClass(spacing: SectionSpacingToken): string {
  if (spacing === "tight") return "lp-section-tight";
  if (spacing === "wide") return "lp-section-wide";
  return "lp-section";
}

function sectionSurfaceModifierClasses(surface: SectionSurfaceToken): string[] {
  if (surface === "alt") return ["alt"];
  if (surface === "contrast") return ["lp-section--contrast"];
  return [];
}

export type MarketingSectionOptions = {
  motion?: boolean;
  divider?: boolean;
};

/**
 * Marketing `<section>` root: spacing + surface + theme (block theme) + optional motion/divider.
 */
export function marketingSectionClassString(merged: MergedDesign, opts?: MarketingSectionOptions): string {
  const motion = opts?.motion === true ? "lp-motion-card" : "";
  const divider = opts?.divider === true ? "lp-section--divider" : "";
  const base = sectionSpacingBaseClass(merged.spacing.section);
  const surfaceMods = sectionSurfaceModifierClasses(merged.surface.section);
  const themeMods = DESIGN_CONFIG.themes[merged.theme].sectionModifiers;
  return [base, ...surfaceMods, ...themeMods, motion, divider].filter(Boolean).join(" ");
}

/** Inner content width for CMS blocks. */
export function marketingContainerClassString(merged: MergedDesign): string {
  const w = merged.container.container;
  if (w === "wide") return "lp-container-wide";
  if (w === "full") return "lp-container-full";
  return "lp-container";
}

/** Heading levels for CMS blocks (not raw sizes). */
export function mergedHeadingClassString(merged: MergedDesign, level: "h1" | "h2" | "h3"): string {
  const isDisplay = merged.typography.heading === "display";
  if (level === "h1") {
    return isDisplay
      ? "font-display lp-display lp-text whitespace-pre-line tracking-tight"
      : "font-display lp-text whitespace-pre-line text-2xl font-semibold tracking-tight md:text-3xl";
  }
  if (level === "h2") {
    return isDisplay
      ? "font-display lp-display whitespace-pre-line"
      : "font-heading lp-text lp-h2 whitespace-pre-line";
  }
  return isDisplay
    ? "font-display lp-display lp-h3 whitespace-pre-line"
    : "font-heading lp-text lp-h3 whitespace-pre-line";
}

export function mergedBodyClassString(merged: MergedDesign, opts?: { measure?: boolean }): string {
  const compact = merged.typography.body === "compact";
  return [
    "font-body",
    "whitespace-pre-line",
    compact ? "lp-p-sm" : "lp-p",
    opts?.measure === true ? "lp-measure" : "",
    "mt-2",
    "leading-relaxed",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Public header inner grid (aligns with `marketingContainerClassString` width). */
export function marketingHeaderInnerGridClass(designSettings: ParsedDesignSettings | null | undefined): string {
  const merged = mergeFullDesign(null, designSettings ?? null, "default");
  const w = merged.container.container;
  const max =
    w === "wide" ? "max-w-[1600px]"
    : w === "full" ? "max-w-none"
    : "max-w-[1440px]";
  return ["mx-auto", "grid", "w-full", max, "grid-cols-[1fr_auto_1fr]", "items-center", "px-4", "py-3", "md:py-4"]
    .filter(Boolean)
    .join(" ");
}

/** Footer inner shell + max width from global layout.container + existing containerMode. */
export function marketingFooterInnerClass(
  designSettings: ParsedDesignSettings | null | undefined,
  containerMode: "container" | "full",
): string {
  const merged = mergeFullDesign(null, designSettings ?? null, "default");
  const w = merged.container.container;
  const shell = "lp-footer-shell";
  if (containerMode === "full") {
    if (w === "full") return shell;
    if (w === "wide") return `${shell} lp-max-1600`;
    return shell;
  }
  if (w === "wide") return `${shell} lp-max-1600`;
  return `${shell} lp-max-1400`;
}

function globalCardLayerFromDesignSettings(
  designSettings: ParsedDesignSettings | null | undefined,
  blockType: string,
): CardConfig {
  if (!designSettings?.card) return {};
  const def = designSettings.card.default ?? {};
  const spec = designSettings.card[blockType] ?? {};
  return { ...def, ...spec };
}

function parseDesignSettingsCardOnly(ds: Record<string, unknown>): Partial<Record<string, CardConfig>> {
  const rawCard = ds.card;
  if (!rawCard || typeof rawCard !== "object" || Array.isArray(rawCard)) return {};
  const card: Partial<Record<string, CardConfig>> = {};
  for (const [k, v] of Object.entries(rawCard)) {
    const key = k.trim();
    if (!key) continue;
    const parsed = parseCardConfig(v);
    if (parsed && (parsed.variant !== undefined || parsed.hover !== undefined)) {
      card[key] = parsed;
    }
  }
  return card;
}

/**
 * Read `designSettings` from published global settings root (`global_content.settings.data`).
 * Safe on server or client; never throws.
 */
export function parseDesignSettingsFromSettingsData(root: unknown): ParsedDesignSettings {
  const empty: ParsedDesignSettings = {
    card: {},
    surface: { ...DEFAULT_PARSED_SURFACE },
    spacing: { ...DEFAULT_PARSED_SPACING },
    typography: { ...DEFAULT_PARSED_TYPO },
    layout: { ...DEFAULT_PARSED_LAYOUT },
  };
  if (!root || typeof root !== "object" || Array.isArray(root)) return empty;
  const r = root as Record<string, unknown>;
  const rawDs = r.designSettings;
  if (!rawDs || typeof rawDs !== "object" || Array.isArray(rawDs)) return empty;
  const ds = rawDs as Record<string, unknown>;
  const card = parseDesignSettingsCardOnly(ds);
  const s = parseSurfaceConfig(ds.surface);
  const sp = parseSpacingConfig(ds.spacing);
  const ty = parseTypographyConfig(ds.typography);
  const ly = parseLayoutConfig(ds.layout);
  return {
    card,
    surface: { section: s.section ?? DEFAULT_PARSED_SURFACE.section },
    spacing: { section: sp.section ?? DEFAULT_PARSED_SPACING.section },
    typography: {
      heading: ty.heading ?? DEFAULT_PARSED_TYPO.heading,
      body: ty.body ?? DEFAULT_PARSED_TYPO.body,
    },
    layout: { container: ly.container ?? DEFAULT_PARSED_LAYOUT.container },
  };
}

function sanitizeMergedCard(merged: MergedCardConfig, preset: MergedCardConfig): MergedCardConfig {
  const variant =
    merged.variant === "default" ||
    merged.variant === "glass" ||
    merged.variant === "elevated" ||
    merged.variant === "flat"
      ? merged.variant
      : preset.variant;
  const hover =
    merged.hover === "none" || merged.hover === "lift" || merged.hover === "glow" ? merged.hover : preset.hover;
  return { variant, hover };
}

/**
 * Resolve card variant + hover: block.config.card overrides global designSettings, which overrides code presets.
 */
export function resolvedCardForBlockType(
  blockType: string,
  cardPartial: CardConfig | undefined,
  designSettings?: ParsedDesignSettings | null,
): MergedCardConfig {
  const preset = BLOCK_CARD_PRESETS[blockType] ?? { variant: "default" as const, hover: "none" as const };
  const globalLayer = globalCardLayerFromDesignSettings(designSettings ?? null, blockType);
  const merged: MergedCardConfig = { ...preset, ...globalLayer, ...(cardPartial ?? {}) };
  return sanitizeMergedCard(merged, preset);
}

const CARD_VARIANT_CLASSES: Record<CardVariant, string[]> = {
  default: ["lp-card", "soft", "lp-card-pad"],
  glass: ["lp-glass-surface", "rounded-[var(--lp-radius-card)]", "p-6"],
  elevated: ["lp-card", "lp-card--elevated", "lp-card-pad"],
  flat: ["lp-card", "lp-card-pad", "!shadow-none"],
};

const CARD_HOVER_CLASSES: Record<CardHover, string[]> = {
  none: [],
  lift: ["lp-motion-hover-lift"],
  glow: ["lp-motion-card"],
};

/** Space-separated class string for inner card surfaces (not section roots). */
export function cardSurfaceClassString(card: MergedCardConfig): string {
  const v = [...CARD_VARIANT_CLASSES[card.variant], ...CARD_HOVER_CLASSES[card.hover]];
  return v.filter(Boolean).join(" ");
}

/**
 * Pricing plan tiles (CMS pricing block + live home pricing): same variant/hover contract as other cards.
 */
export function pricingPlanSurfaceClassString(
  featured: boolean,
  cardPartial: CardConfig | undefined,
  designSettings?: ParsedDesignSettings | null,
): string {
  const rc = resolvedCardForBlockType("pricing", cardPartial, designSettings);
  const hover =
    rc.hover === "lift" ? "lp-motion-hover-lift"
    : rc.hover === "glow" ? "lp-motion-card"
    : "";
  const feat = featured ? "featured" : "";
  if (rc.variant === "glass") {
    return ["lp-glass-surface", "rounded-[var(--lp-radius-card)]", "p-6", "pricing", feat, hover].filter(Boolean).join(" ");
  }
  if (rc.variant === "flat") {
    return ["lp-card", "pricing", "!shadow-none", feat, hover].filter(Boolean).join(" ");
  }
  if (rc.variant === "elevated") {
    return ["lp-card", "lp-card--elevated", "pricing", feat, hover].filter(Boolean).join(" ");
  }
  return ["lp-card", "pricing", feat, hover].filter(Boolean).join(" ");
}

/** Section root: `lp-section` + theme modifiers (e.g. alt, lp-bg-muted). */
export function sectionClassForConfig(baseSectionClass: string, theme: BlockTheme): string {
  const mods = DESIGN_CONFIG.themes[theme].sectionModifiers;
  return [baseSectionClass, ...mods].filter(Boolean).join(" ");
}

/** Theme modifiers only (e.g. for `lp-hero` roots that are not `.lp-section`). */
export function themeSectionModifierClasses(theme: BlockTheme): string {
  return DESIGN_CONFIG.themes[theme].sectionModifiers.filter(Boolean).join(" ");
}

/** Hero layout classes from config (lp-* only). */
export function heroLayoutClassList(layout: BlockLayout): string[] {
  return [...DESIGN_CONFIG.layouts[layout].heroModifiers];
}

export function stripForbiddenDesignFromData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return stripDeepObject(data as Record<string, unknown>) as Record<string, unknown>;
}

function stripDeepObject(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) {
      if (FORBIDDEN_BLOCK_DATA_DESIGN_KEYS.has(k)) continue;
      out[k] = stripDeepObject(val);
    }
    return out;
  }
  if (Array.isArray(v)) return v.map(stripDeepObject);
  return v;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function mergeDesignSettingsNested(
  prevDs: Record<string, unknown>,
  key: "surface" | "spacing" | "typography" | "layout",
  patchVal: Record<string, unknown> | undefined,
): void {
  if (!patchVal || !isPlainObject(patchVal)) return;
  const prev = isPlainObject(prevDs[key]) ? { ...(prevDs[key] as Record<string, unknown>) } : {};
  prevDs[key] = { ...prev, ...patchVal };
}

/**
 * Merge a DesignSettings patch into existing global settings `data` (save/publish payload).
 * Use for CMS UI and AI flows that adjust site-wide tokens — not per-block `config`.
 */
export function mergeDesignSettingsIntoGlobalContentData(
  existingData: Record<string, unknown>,
  patch: DesignSettingsDocument,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existingData };
  const prevDs = isPlainObject(next.designSettings) ? { ...next.designSettings } : {};
  if (patch.card != null && isPlainObject(patch.card)) {
    const prevCard = isPlainObject(prevDs.card) ? { ...(prevDs.card as Record<string, unknown>) } : {};
    prevDs.card = { ...prevCard, ...patch.card };
  }
  mergeDesignSettingsNested(prevDs, "surface", patch.surface);
  mergeDesignSettingsNested(prevDs, "spacing", patch.spacing);
  mergeDesignSettingsNested(prevDs, "typography", patch.typography);
  mergeDesignSettingsNested(prevDs, "layout", patch.layout);
  next.designSettings = prevDs;
  return next;
}

/** Meta keys on saved page body `{ blocks, meta }` for layered CMS design (global → page → section → block). */
export const CMS_META_PAGE_DESIGN_KEY = "pageDesign";
export const CMS_META_SECTION_DESIGN_KEY = "sectionDesign";

/**
 * Inner `designSettings` document from published global `settings.data` (raw root).
 */
export function extractDesignSettingsInnerFromGlobalDataRoot(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const ds = (data as Record<string, unknown>).designSettings;
  if (!ds || typeof ds !== "object" || Array.isArray(ds)) return {};
  return { ...(ds as Record<string, unknown>) };
}

/**
 * Merge global settings root + page `meta` + optional section overlay, then parse once.
 * Page and section overlays use the same {@link DesignSettingsDocument} shape as site-wide `designSettings` (presets/tokens only).
 */
export function buildEffectiveParsedDesignSettingsLayered(
  globalDataRoot: unknown,
  pageMeta: Record<string, unknown> | null | undefined,
  sectionId: string | null | undefined,
): ParsedDesignSettings {
  const globalInner = extractDesignSettingsInnerFromGlobalDataRoot(globalDataRoot);
  const pageRaw = pageMeta?.[CMS_META_PAGE_DESIGN_KEY];
  const pageInner = isPlainObject(pageRaw) ? (pageRaw as Record<string, unknown>) : {};

  let sectionInner: Record<string, unknown> = {};
  if (sectionId && typeof sectionId === "string" && sectionId.trim()) {
    const map = pageMeta?.[CMS_META_SECTION_DESIGN_KEY];
    if (isPlainObject(map)) {
      const sec = (map as Record<string, unknown>)[sectionId.trim()];
      if (isPlainObject(sec)) sectionInner = sec as Record<string, unknown>;
    }
  }

  const mergedPage = mergeDesignSettingsIntoGlobalContentData(
    { designSettings: globalInner },
    pageInner as DesignSettingsDocument,
  ).designSettings as Record<string, unknown>;

  const mergedAll = mergeDesignSettingsIntoGlobalContentData(
    { designSettings: mergedPage },
    sectionInner as DesignSettingsDocument,
  ).designSettings as Record<string, unknown>;

  return parseDesignSettingsFromSettingsData({ designSettings: mergedAll });
}
