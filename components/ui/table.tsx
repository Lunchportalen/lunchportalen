import * as React from "react";
import {
  type TableVariant,
  type RowVariant,
  getTableVariantClass,
  getRowVariantClass,
} from "@/lib/ui/tableRowVariants";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type TableProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Visual variant (wrapper surface). When set, replaces default surface/ring/shadow. */
  variant?: TableVariant;
};

/**
 * Wrapper rundt <table> som gir:
 * - sticky header ready (hvis du vil)
 * - horisontal scrolling uten at layout sprekker
 * - consistent border/shadow tokens (or variant: glass | soft | gradient | outline | glow)
 */
export const Table = React.forwardRef<HTMLDivElement, TableProps>(function Table(
  { className, variant, ...props },
  ref
) {
  const variantClass = getTableVariantClass(variant);
  return (
    <div
      ref={ref}
      className={cn(
        "w-full overflow-x-auto",
        variantClass
          ? variantClass
          : "rounded-2xl bg-[color:var(--lp-surface)] ring-1 ring-[color:var(--lp-border)] shadow-[var(--lp-shadow-sm)] [box-shadow:var(--lp-shadow-sm),var(--lp-shadow-inset)]",
        className
      )}
      {...props}
    />
  );
});
Table.displayName = "Table";

export type TableElementProps = React.TableHTMLAttributes<HTMLTableElement>;

export const TableElement = React.forwardRef<HTMLTableElement, TableElementProps>(function TableElement(
  { className, ...props },
  ref
) {
  return (
    <table
      ref={ref}
      className={cn("w-full border-collapse text-sm text-[color:var(--lp-fg)]", className)}
      {...props}
    />
  );
});
TableElement.displayName = "TableElement";

export const THead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function THead({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn(
        "border-b border-[color:var(--lp-border)] bg-[color:var(--lp-surface-2)] text-[color:var(--lp-muted)]",
        className
      )}
      {...props}
    />
  );
});
THead.displayName = "THead";

export const TBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn(
        "text-[color:var(--lp-fg)]",
        "[&>tr:nth-child(even)]:bg-[color:var(--lp-surface-2)]",
        className
      )}
      {...props}
    />
  );
});
TBody.displayName = "TBody";

export type TRProps = React.HTMLAttributes<HTMLTableRowElement> & {
  /** Row surface variant (hover/selected in motion.css). Prefer outline/soft for dense data. */
  variant?: RowVariant;
  /** Selected state (adds lp-row--selected / aria-selected). */
  selected?: boolean;
  /** Summary/grouped row (adds lp-row-summary). */
  summary?: boolean;
};

export const TR = React.forwardRef<HTMLTableRowElement, TRProps>(function TR(
  { className, variant, selected, summary, ...props },
  ref
) {
  const rowVariantClass = getRowVariantClass(variant);
  return (
    <tr
      ref={ref}
      className={cn(
        "lp-motion-row",
        rowVariantClass
          ? cn(rowVariantClass, selected && "lp-row--selected", summary && "lp-row-summary")
          : cn(
              "border-b border-[color:var(--lp-border)] hover:bg-[color:var(--lp-surface-alt)]",
              summary && "lp-row-summary"
            ),
        "last:border-b-0",
        className
      )}
      aria-selected={selected}
      {...props}
    />
  );
});
TR.displayName = "TR";

export const TH = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function TH({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        "px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--lp-muted)]",
        "whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
});
TH.displayName = "TH";

export const TD = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function TD({ className, ...props }, ref) {
  const isSpanning = typeof props.colSpan === "number" && props.colSpan > 1;
  return (
    <td
      ref={ref}
      className={cn(
        "px-5 py-3.5 align-middle text-sm font-normal text-[color:var(--lp-fg)]",
        isSpanning && "py-10 text-[color:var(--lp-muted)]",
        className
      )}
      {...props}
    />
  );
});
TD.displayName = "TD";

/**
 * Optional helper:
 * A compact row variant you can apply via className on TR
 * "py-2" etc. Keep it simple.
 */
