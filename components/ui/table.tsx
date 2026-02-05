import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type TableProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Wrapper rundt <table> som gir:
 * - sticky header ready (hvis du vil)
 * - horisontal scrolling uten at layout sprekker
 * - consistent border/shadow tokens
 */
export const Table = React.forwardRef<HTMLDivElement, TableProps>(function Table(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "w-full overflow-x-auto rounded-3xl",
        "bg-[color:var(--lp-surface)] ring-1 ring-[color:var(--lp-border)]",
        "shadow-[var(--lp-shadow-sm)] [box-shadow:var(--lp-shadow-sm),var(--lp-shadow-inset)]",
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
        "bg-[color:var(--lp-surface-2)] text-[color:var(--lp-muted)]",
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
  return <tbody ref={ref} className={cn("text-[color:var(--lp-fg)]", className)} {...props} />;
});
TBody.displayName = "TBody";

export const TR = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  function TR({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={cn(
          "border-b border-[color:var(--lp-border)]",
          "transition-[background-color] duration-200 [transition-timing-function:var(--lp-ease)]",
          "hover:bg-[color:var(--lp-surface-2)]",
          className
        )}
        {...props}
      />
    );
  }
);
TR.displayName = "TR";

export const TH = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function TH({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--lp-muted)]",
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
        "px-4 py-3 align-middle font-normal text-[color:var(--lp-fg)]",
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
