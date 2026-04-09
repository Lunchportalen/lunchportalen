/**
 * U91 — Canonical block entry contract (Umbraco-style): contentData + settingsData + structureData,
 * single source for flattening (render/preview), tree labels, and legacy migration.
 *
 * Persisted workspace JSON may be legacy (flat per-type fields) or entry-shaped (nested layers).
 * Load path normalizes to entry-shaped `Block` in `normalizeBlock`; render path flattens via
 * `getBlockEntryFlatForRender`.
 */

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import type { BlockVariant } from "@/lib/cms/blocks/blockContracts";
import type {
  CardRow,
  GridItemRow,
  PricingPlanRow,
  ZigzagStep,
} from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockTypeDefinition, KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS } from "@/lib/cms/blocks/blockTypeDefinitions";

export const BLOCK_ENTRY_CONTRACT_MARK = "U91_BLOCK_ENTRY_CONTRACT";

/** Re-export for tests / adapters — same tuple as `BLOCK_ENTRY_MODEL_ALIASES`. */
export { KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS };

/** Aliases that use the entry model (content/settings/structure). */
export const BLOCK_ENTRY_MODEL_ALIASES = KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS;

export type BlockEntryModelAlias = (typeof BLOCK_ENTRY_MODEL_ALIASES)[number];

export function isBlockEntryModelAlias(type: string): type is BlockEntryModelAlias {
  return (BLOCK_ENTRY_MODEL_ALIASES as readonly string[]).includes(type);
}

/** Narrows `Block` after entry-model check (for TS exhaustiveness in switches). */
export function isBlockWithEntryModel(b: Block): b is Extract<Block, { type: BlockEntryModelAlias }> {
  return isBlockEntryModelAlias(b.type);
}

function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/** True when row has explicit nested layers (post-U91 canonical editor shape). */
export function isCanonicalEntryRow(row: Record<string, unknown>): boolean {
  return (
    row.contentData != null &&
    typeof row.contentData === "object" &&
    !Array.isArray(row.contentData) &&
    row.settingsData != null &&
    typeof row.settingsData === "object" &&
    !Array.isArray(row.settingsData)
  );
}

/** Legacy = same alias but missing canonical nested `contentData` + `settingsData` pair. */
export function isLegacyFlatBlockRow(type: string, row: Record<string, unknown>): boolean {
  if (!isBlockEntryModelAlias(type)) return false;
  return !isCanonicalEntryRow(row);
}

function parseTriAlign(v: unknown, fallback: "left" | "center" | "right"): "left" | "center" | "right" {
  const s = safeStr(v).toLowerCase();
  if (s === "left" || s === "right" || s === "center") return s;
  return fallback;
}

/**
 * Merge layers → flat record matching public `renderBlock` / historical editor field names.
 */
export function mergeEntryLayersToFlatRecord(
  type: string,
  contentData: Record<string, unknown>,
  settingsData: Record<string, unknown>,
  structureData: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const struct = structureData ?? {};
  switch (type) {
    case "hero":
      return { ...contentData, ...settingsData };
    case "hero_full":
      return { ...contentData, ...settingsData };
    case "hero_bleed":
      return { ...contentData, ...settingsData };
    case "cards":
      return {
        ...contentData,
        ...settingsData,
        items: struct.items ?? [],
        ...(Array.isArray(struct.cta) && struct.cta.length ? { cta: struct.cta } : {}),
      };
    case "zigzag":
      return {
        ...contentData,
        ...settingsData,
        steps: Array.isArray(struct.steps) ? struct.steps : [],
      };
    case "pricing":
      return {
        ...contentData,
        ...settingsData,
        plans: Array.isArray(struct.plans) ? struct.plans : [],
      };
    case "grid":
      return {
        ...contentData,
        ...settingsData,
        items: Array.isArray(struct.items) ? struct.items : [],
      };
    case "cta":
      return {
        ...contentData,
        ...settingsData,
        ...struct,
      };
    case "relatedLinks":
      return {
        ...contentData,
        ...settingsData,
        tags: Array.isArray(struct.tags) ? struct.tags : [],
      };
    default:
      return { ...contentData, ...settingsData, ...struct };
  }
}

/**
 * Flatten a normalized `Block` union member for render / canvas preview / hints.
 */
export function getBlockEntryFlatForRender(block: Block): Record<string, unknown> {
  switch (block.type) {
    case "hero":
      return mergeEntryLayersToFlatRecord("hero", block.contentData as Record<string, unknown>, block.settingsData, {});
    case "hero_full":
      return mergeEntryLayersToFlatRecord(
        "hero_full",
        block.contentData as Record<string, unknown>,
        block.settingsData,
        {},
      );
    case "hero_bleed":
      return mergeEntryLayersToFlatRecord(
        "hero_bleed",
        block.contentData as Record<string, unknown>,
        block.settingsData,
        {},
      );
    case "cards":
      return mergeEntryLayersToFlatRecord("cards", block.contentData as Record<string, unknown>, block.settingsData, {
        items: block.structureData.items,
        ...(block.structureData.cta?.length ? { cta: block.structureData.cta } : {}),
      });
    case "zigzag":
      return mergeEntryLayersToFlatRecord("zigzag", block.contentData as Record<string, unknown>, block.settingsData, {
        steps: block.structureData.steps,
      });
    case "pricing":
      return mergeEntryLayersToFlatRecord("pricing", block.contentData as Record<string, unknown>, block.settingsData, {
        plans: block.structureData.plans,
      });
    case "grid":
      return mergeEntryLayersToFlatRecord("grid", block.contentData as Record<string, unknown>, block.settingsData, {
        items: block.structureData.items,
      });
    case "cta":
      return mergeEntryLayersToFlatRecord("cta", block.contentData as Record<string, unknown>, block.settingsData, {
        buttonLabel: block.structureData.buttonLabel,
        buttonHref: block.structureData.buttonHref,
        secondaryButtonLabel: block.structureData.secondaryButtonLabel,
        secondaryButtonHref: block.structureData.secondaryButtonHref,
      });
    case "relatedLinks":
      return mergeEntryLayersToFlatRecord(
        "relatedLinks",
        block.contentData as Record<string, unknown>,
        block.settingsData,
        { tags: block.structureData.tags },
      );
    default:
      return { ...(block as unknown as Record<string, unknown>) };
  }
}

/** Expand a raw persisted/editor row (possibly legacy flat) to flat render fields. */
export function expandRawBlockRowToFlatRenderFields(row: Record<string, unknown>): Record<string, unknown> {
  const type = safeStr(row.type);
  if (!isBlockEntryModelAlias(type)) {
    const { id: _i, type: _t, config: _c, data: _d, ...rest } = row;
    return rest;
  }
  if (isCanonicalEntryRow(row)) {
    const c = safeObj(row.contentData);
    const s = safeObj(row.settingsData);
    const st = row.structureData != null && typeof row.structureData === "object" && !Array.isArray(row.structureData)
      ? (row.structureData as Record<string, unknown>)
      : {};
    return mergeEntryLayersToFlatRecord(type, c, s, st);
  }
  const { id: _id, type: _ty, config: _cf, data: _da, ...legacyFlat } = row;
  return legacyFlat;
}

// ——— Label / identity (canonical: definitions.previewSummaryBuilder on flat projection) ———

export function buildBlockEntryPreviewSummary(block: Block): string {
  const def = getBlockTypeDefinition(block.type);
  const flat = getBlockEntryFlatForRender(block);
  if (def?.previewSummaryBuilder) return def.previewSummaryBuilder(flat);
  return safeStr(flat.title) || block.type;
}

/** Tree / navigator label — deterministic, content-aware. */
export function buildBlockEntryTreeLabel(block: Block): string {
  const flat = getBlockEntryFlatForRender(block);
  const truncate = (s: string, n: number) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length <= n) return t;
    return t.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
  };
  switch (block.type) {
    case "hero": {
      const title = safeStr(flat.title);
      const subtitle = safeStr(flat.subtitle);
      const cta = safeStr(flat.ctaLabel);
      const primary = title || subtitle || cta;
      return primary ? truncate(`Hero · ${primary}`, 42) : "Hero-seksjon";
    }
    case "hero_full": {
      const title = safeStr(flat.title);
      const subtitle = safeStr(flat.subtitle);
      const cta = safeStr(flat.ctaLabel);
      const primary = title || subtitle || cta;
      return primary ? truncate(`Hero FB · ${primary}`, 42) : "Hero (full bredde)";
    }
    case "hero_bleed": {
      const title = safeStr(flat.title);
      const subtitle = safeStr(flat.subtitle);
      const cta = safeStr(flat.ctaPrimary);
      const primary = title || subtitle || cta;
      return primary ? truncate(`Hero full · ${primary}`, 42) : "Hero (kant til kant)";
    }
    case "cards": {
      const t = safeStr(flat.title);
      const items = Array.isArray(flat.items) ? flat.items : [];
      const n = items.length;
      const filled = items.filter(
        (it: unknown) => safeStr(safeObj(it).title) && safeStr(safeObj(it).text),
      ).length;
      const extra = n ? ` · ${filled}/${n}` : "";
      return t ? truncate(`Kort · ${t}${extra}`, 42) : `Kort-seksjon${extra}`;
    }
    case "zigzag": {
      const t = safeStr(flat.title);
      const steps = Array.isArray(flat.steps) ? flat.steps : [];
      const n = steps.length;
      const mode = safeStr(flat.presentation).toLowerCase() === "faq" ? "FAQ" : "Prosess";
      return t ? truncate(`Steg · ${t} · ${mode}${n ? ` (${n})` : ""}`, 42) : `Steg · ${mode}`;
    }
    case "pricing": {
      const t = safeStr(flat.title);
      const plans = Array.isArray(flat.plans) ? flat.plans : [];
      const n = plans.length;
      const feat = plans.filter((p: unknown) => safeObj(p).featured === true).length;
      const ctaN = plans.filter(
        (p: unknown) => safeStr(safeObj(p).ctaLabel) && safeStr(safeObj(p).ctaHref),
      ).length;
      if (n === 0) return "Priser · live priser (ingen manuelle pakker)";
      return `${n} plan${n === 1 ? "" : "er"} · ${feat} fremhevet · ${ctaN} med CTA`;
    }
    case "grid": {
      const t = safeStr(flat.title);
      const items = Array.isArray(flat.items) ? flat.items : [];
      const n = items.length;
      return t ? truncate(`Lokasjoner · ${t}${n ? ` (${n})` : ""}`, 42) : "Lokasjonsrutenett";
    }
    case "cta": {
      const button = safeStr(flat.buttonLabel);
      const title = safeStr(flat.title);
      const primary = button || title;
      return primary ? truncate(`CTA · ${primary}`, 42) : "CTA / handlingsseksjon";
    }
    case "relatedLinks": {
      const tags = Array.isArray(flat.tags) ? flat.tags : [];
      const n = tags.length;
      const t = safeStr(flat.title);
      return t ? truncate(`Relaterte · ${t}${n ? ` · ${n} tag` : ""}`, 42) : n ? `Relaterte · ${n} stikkord` : "Relaterte sider";
    }
    default:
      return buildBlockEntryPreviewSummary(block);
  }
}

export function getBlockEntryEmptyStateHint(type: string): string {
  const def = getBlockTypeDefinition(type);
  if (def?.validationRules?.length) return def.validationRules[0]!.message;
  return "Start med innhold eller innstillinger for denne blokken.";
}

export type BlockEntryLayerStatus = { content: string; settings: string; structure: string };

export function buildBlockEntryLayerStatus(block: Block): BlockEntryLayerStatus {
  const flat = getBlockEntryFlatForRender(block);
  switch (block.type) {
    case "hero": {
      const c = [
        safeStr(flat.title) ? "Tittel OK" : "Mangler tittel",
        safeStr(flat.subtitle) ? "Undertittel" : "Uten undertittel",
        safeStr(flat.ctaLabel) ? "CTA-tekst" : "Uten CTA",
      ].join(" · ");
      return { content: c, settings: "Ingen layout-innstillinger", structure: "Ingen liste" };
    }
    case "hero_full": {
      const c = [
        safeStr(flat.title) ? "Tittel OK" : "Mangler tittel",
        safeStr(flat.imageId) ? "Bilde" : "Uten bilde",
      ].join(" · ");
      const g = flat.useGradient === false ? "Flat overlay" : "Gradient";
      return { content: c, settings: g, structure: "Ingen liste" };
    }
    case "hero_bleed": {
      const c = [
        safeStr(flat.title) ? "Tittel" : "Uten tittel",
        safeStr(flat.backgroundImageId) ? "Bakgrunn OK" : "Mangler bakgrunn",
      ].join(" · ");
      const s = [safeStr(flat.variant) || safeStr(flat.textAlign) || "midt"].join(" ");
      return {
        content: c,
        settings: `Layout · ${s}`,
        structure: "Ingen liste",
      };
    }
    case "cards": {
      const items = Array.isArray(flat.items) ? flat.items : [];
      const filled = items.filter(
        (it: unknown) => safeStr(safeObj(it).title) && safeStr(safeObj(it).text),
      ).length;
      return {
        content: safeStr(flat.text) ? "Har ingress" : "Uten ingress",
        settings: safeStr(flat.presentation) === "plain" ? "Rolige kort" : "Ikonkort",
        structure: `${items.length} kort · ${filled} komplette`,
      };
    }
    case "zigzag": {
      const steps = Array.isArray(flat.steps) ? flat.steps : [];
      const mode = safeStr(flat.presentation).toLowerCase() === "faq" ? "FAQ" : "Prosess";
      return {
        content: safeStr(flat.intro) ? "Har ingress" : "Uten ingress",
        settings: mode,
        structure: `${steps.length} steg`,
      };
    }
    case "pricing": {
      const plans = Array.isArray(flat.plans) ? flat.plans : [];
      return {
        content: safeStr(flat.intro) ? "Ingress" : "Uten ingress",
        settings: plans.some((p: unknown) => safeObj(p).featured === true) ? "Har fremhevet plan" : "Ingen fremheving",
        structure: plans.length ? `${plans.length} planer` : "Live priser (tom liste)",
      };
    }
    case "grid": {
      const items = Array.isArray(flat.items) ? flat.items : [];
      const sub = items.filter((it: unknown) => safeStr(safeObj(it).subtitle)).length;
      const meta = items.filter((it: unknown) => safeStr(safeObj(it).metaLine)).length;
      return {
        content: safeStr(flat.intro) ? "Ingress" : "Uten ingress",
        settings: `Variant ${safeStr(flat.variant) || "center"}`,
        structure: `${items.length} celler · undertittel ${sub}/${items.length} · meta ${meta}/${items.length}`,
      };
    }
    case "cta":
      return {
        content: safeStr(flat.body) ? "Har støttetekst" : "Uten støttetekst",
        settings: "Handlingsfelt",
        structure: [
          safeStr(flat.buttonLabel) ? "Primærknapp" : "Mangler primær",
          safeStr(flat.secondaryButtonLabel) ? "Sekundær" : "Uten sekundær",
        ].join(" · "),
      };
    case "relatedLinks": {
      const tags = Array.isArray(flat.tags) ? flat.tags : [];
      return {
        content: safeStr(flat.subtitle) ? "Har undertekst" : "Uten undertekst",
        settings: `${tags.length} stikkord · maks ${flat.maxSuggestions ?? "std"}`,
        structure: `${tags.length} tag rader`,
      };
    }
    default:
      return { content: "—", settings: "—", structure: "—" };
  }
}

// ——— Migration: legacy flat row → layers (for normalizeBlock) ———

export function migrateLegacyFlatRowToEntryLayers(
  type: BlockEntryModelAlias,
  row: Record<string, unknown>,
): { contentData: Record<string, unknown>; settingsData: Record<string, unknown>; structureData?: Record<string, unknown> } {
  switch (type) {
    case "hero":
      return {
        contentData: {
          title: safeStr(row.title),
          subtitle: safeStr(row.subtitle) || undefined,
          imageId:
            safeStr(row.imageId) || safeStr(row.mediaItemId) || safeStr(row.imageUrl) || undefined,
          mediaItemId:
            typeof row.mediaItemId === "string" && row.mediaItemId.trim() ? row.mediaItemId.trim() : undefined,
          imageAlt: safeStr(row.imageAlt) || undefined,
          ctaLabel: safeStr(row.ctaLabel),
          ctaHref: safeStr(row.ctaHref),
        },
        settingsData: {},
      };
    case "hero_full":
      return {
        contentData: {
          title: safeStr(row.title),
          subtitle: safeStr(row.subtitle) || undefined,
          imageId:
            safeStr(row.imageId) || safeStr(row.mediaItemId) || safeStr(row.imageUrl) || undefined,
          mediaItemId:
            typeof row.mediaItemId === "string" && row.mediaItemId.trim() ? row.mediaItemId.trim() : undefined,
          imageAlt: safeStr(row.imageAlt) || undefined,
          ctaLabel: safeStr(row.ctaLabel),
          ctaHref: safeStr(row.ctaHref),
        },
        settingsData: { useGradient: row.useGradient !== false },
      };
    case "hero_bleed":
      return {
        contentData: {
          title: safeStr(row.title),
          subtitle: safeStr(row.subtitle) || undefined,
          ctaPrimary: safeStr(row.ctaPrimary),
          ctaSecondary: safeStr(row.ctaSecondary),
          ctaPrimaryHref: safeStr(row.ctaPrimaryHref),
          ...(row.ctaPrimaryHrefKind === "internal" || row.ctaPrimaryHrefKind === "external"
            ? { ctaPrimaryHrefKind: row.ctaPrimaryHrefKind }
            : {}),
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
        },
        settingsData: {
          textAlign: parseTriAlign(row.textAlign, "center"),
          textPosition: parseTriAlign(row.textPosition, "center"),
          overlayPosition: parseTriAlign(row.overlayPosition, "right"),
          ...(Object.prototype.hasOwnProperty.call(row, "variant") && safeStr(row.variant) ?
            { variant: parseTriAlign(row.variant, "center") }
          : {}),
        },
      };
    case "cards": {
      const rawItems = Array.isArray(row.items) ? row.items : [];
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
      const rawCta = Array.isArray(row.cta) ? row.cta : [];
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
      const pres = safeStr(row.presentation).toLowerCase();
      const presentation = pres === "plain" ? "plain" : pres === "feature" ? "feature" : undefined;
      return {
        contentData: { title: safeStr(row.title), text: safeStr(row.text) },
        settingsData: { ...(presentation ? { presentation } : {}) },
        structureData: { items, ...(cta.length ? { cta } : {}) },
      };
    }
    case "zigzag": {
      const rawSteps = Array.isArray(row.steps) ? row.steps : [];
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
      const intro = safeStr(row.intro) || undefined;
      const zp = safeStr(row.presentation).toLowerCase();
      const presentation = zp === "faq" ? "faq" : zp === "process" ? "process" : undefined;
      return {
        contentData: { title: safeStr(row.title), ...(intro ? { intro } : {}) },
        settingsData: { ...(presentation ? { presentation } : {}) },
        structureData: { steps },
      };
    }
    case "pricing": {
      const rawPlans = Array.isArray(row.plans) ? row.plans : [];
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
      const footnote = safeStr(row.footnote) || undefined;
      return {
        contentData: {
          title: safeStr(row.title),
          intro: safeStr(row.intro) || safeStr(row.subtitle) || undefined,
          ...(footnote ? { footnote } : {}),
        },
        settingsData: {},
        structureData: { plans },
      };
    }
    case "grid": {
      const rawItems = Array.isArray(row.items) ? row.items : [];
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
      const intro = safeStr(row.intro) || undefined;
      return {
        contentData: { title: safeStr(row.title), ...(intro ? { intro } : {}) },
        settingsData: { variant: parseTriAlign(row.variant, "center") },
        structureData: { items },
      };
    }
    case "cta":
      return {
        contentData: {
          eyebrow: safeStr(row.eyebrow) || undefined,
          title: safeStr(row.title),
          body: safeStr(row.body),
        },
        settingsData: {},
        structureData: {
          buttonLabel: safeStr(row.buttonLabel),
          buttonHref: safeStr(row.buttonHref),
          secondaryButtonLabel: safeStr(row.secondaryButtonLabel) || undefined,
          secondaryButtonHref: safeStr(row.secondaryButtonHref) || undefined,
        },
      };
    case "relatedLinks": {
      const rawTags = Array.isArray(row.tags) ? row.tags : [];
      const tags = rawTags.map((t) => String(t ?? "").trim()).filter(Boolean);
      const emptyFallbackText = safeStr(row.emptyFallbackText) || undefined;
      let maxSuggestions: number | undefined;
      if (typeof row.maxSuggestions === "number" && Number.isFinite(row.maxSuggestions)) {
        const n = Math.round(row.maxSuggestions);
        if (n >= 1 && n <= 12) maxSuggestions = n;
      }
      return {
        contentData: {
          title: safeStr(row.title) || undefined,
          subtitle: safeStr(row.subtitle) || undefined,
          ...(emptyFallbackText ? { emptyFallbackText } : {}),
        },
        settingsData: {
          currentPath: safeStr(row.currentPath) || "/",
          ...(maxSuggestions != null ? { maxSuggestions } : {}),
        },
        structureData: { tags: tags.length ? tags : [] },
      };
    }
  }
}

/** Unified load path: canonical nested row eller legacy flat → tre lag. */
/**
 * Canvas inline edit (PreviewCanvas) sender flate patches — mappes inn i entry-lag for U91-blokker.
 */
export function mergeVisualInlinePatchIntoBlock(block: Block, patch: Record<string, unknown>): Block {
  if (block.type === "hero_bleed") {
    const cd = { ...block.contentData };
    const sd = { ...block.settingsData };
    if ("title" in patch) cd.title = String(patch.title ?? "");
    if ("subtitle" in patch) cd.subtitle = String(patch.subtitle ?? "");
    if ("ctaPrimary" in patch) cd.ctaPrimary = String(patch.ctaPrimary ?? "");
    if ("variant" in patch && patch.variant != null) {
      const v = String(patch.variant).toLowerCase() as BlockVariant;
      if (v === "left" || v === "center" || v === "right") {
        sd.variant = v;
        sd.textAlign = v;
        sd.textPosition = v;
        sd.overlayPosition = v;
      }
    }
    return { ...block, contentData: cd, settingsData: sd };
  }
  return { ...block, ...patch } as Block;
}

export function getEntryLayersFromUnifiedRow(
  type: BlockEntryModelAlias,
  row: Record<string, unknown>,
): {
  contentData: Record<string, unknown>;
  settingsData: Record<string, unknown>;
  structureData: Record<string, unknown>;
} {
  if (isCanonicalEntryRow(row)) {
    return {
      contentData: safeObj(row.contentData),
      settingsData: safeObj(row.settingsData),
      structureData:
        row.structureData != null && typeof row.structureData === "object" && !Array.isArray(row.structureData)
          ? safeObj(row.structureData)
          : {},
    };
  }
  const m = migrateLegacyFlatRowToEntryLayers(type, row);
  return {
    contentData: m.contentData,
    settingsData: m.settingsData,
    structureData: m.structureData ?? {},
  };
}
