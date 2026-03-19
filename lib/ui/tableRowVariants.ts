/**
 * LUNCHPORTALEN — Table/row visual variants (primitives from lib/ui/motion.css).
 * Wired to Table and TR (components/ui/table.tsx). Use lp-motion-row for hover.
 * Selected: lp-row--selected or aria-selected="true". Summary row: lp-row-summary (TR summary prop).
 * Prefer outline/soft for dense data; selected state must remain unmistakable.
 */

export type TableVariant = "glass" | "soft" | "gradient" | "outline" | "glow";
export type RowVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-table-* class (wrapper around <table>) */
export const tableVariantClasses: Record<TableVariant, string> = {
  glass: "lp-table-glass",
  soft: "lp-table-soft",
  gradient: "lp-table-gradient",
  outline: "lp-table-outline",
  glow: "lp-table-glow",
};

/** Map variant to lp-row-* class (<tr> or list row) */
export const rowVariantClasses: Record<RowVariant, string> = {
  glass: "lp-row-glass",
  soft: "lp-row-soft",
  gradient: "lp-row-gradient",
  outline: "lp-row-outline",
  glow: "lp-row-glow",
};

export function getTableVariantClass(variant: TableVariant | undefined): string {
  return variant ? tableVariantClasses[variant] : "";
}

export function getRowVariantClass(variant: RowVariant | undefined): string {
  return variant ? rowVariantClasses[variant] : "";
}
