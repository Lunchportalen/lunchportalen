/**
 * Global CMS block contract: layout is system-owned; editors expose at most `variant`.
 * Additive with legacy blocks: positions stay independent until a valid `variant` is persisted.
 */

export type BlockVariant = "left" | "right" | "center";

/** All editor / API block rows should be assignable to this shape (flat or nested in data). */
export type BaseBlock = {
  id: string;
  type: string;
  variant?: BlockVariant;
};

function normalizeVariant(v: unknown): BlockVariant {
  const s = String(v ?? "").toLowerCase();
  if (s === "left" || s === "right" || s === "center") return s;
  return "center";
}

function isValidVariant(v: unknown): v is BlockVariant {
  const s = String(v ?? "").toLowerCase();
  return s === "left" || s === "right" || s === "center";
}

/**
 * Before render: ensure safe defaults and optional locked layout for `hero_bleed`.
 * - Persisted valid `variant` → textPosition, textAlign, overlayPosition match (locked component).
 * - No valid persisted `variant` → derive `variant` from textPosition for labels only; do not move overlay/text.
 */
export function enforceBlockComponentSafety(type: string, data: Record<string, unknown>): void {
  if (
    type === "banner" ||
    type === "banner_carousel" ||
    type === "accordion_tabs" ||
    type === "anchor_navigation" ||
    type === "anchorNavigation" ||
    type === "dual_promo_cards" ||
    type === "dualPromoCardsBlock"
  ) {
    data.variant = "center";
    return;
  }
  if (type === "grid_3") {
    data.variant = normalizeVariant(data.variant ?? "center");
    return;
  }

  if (type !== "hero_bleed") return;

  const rawVariant = data.variant;
  const hasPersistedVariant =
    Object.prototype.hasOwnProperty.call(data, "variant") &&
    rawVariant != null &&
    String(rawVariant).trim() !== "" &&
    isValidVariant(rawVariant);

  if (hasPersistedVariant) {
    const v = normalizeVariant(rawVariant);
    data.variant = v;
    data.textPosition = v;
    data.textAlign = v;
    data.overlayPosition = v;
    return;
  }

  if (Object.prototype.hasOwnProperty.call(data, "variant") && rawVariant != null && String(rawVariant).trim() !== "") {
    delete data.variant;
  }

  data.variant = normalizeVariant(data.textPosition ?? data.textAlign ?? "center");
}
