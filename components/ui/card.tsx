import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/** Card visual variant; uses primitives from lib/ui/motion.css */
export type CardVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-card-* class (single source of truth for class-based usage) */
export const cardVariantClasses: Record<CardVariant, string> = {
  glass: "lp-card-glass",
  soft: "lp-card-soft",
  gradient: "lp-card-gradient",
  outline: "lp-card-outline",
  glow: "lp-card-glow",
};

export function getCardVariantClass(variant: CardVariant | undefined): string {
  return variant ? cardVariantClasses[variant] : "";
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Visual variant; omit for default .lp-card look. Uses lp-card-* classes from lib/ui/motion.css. */
  variant?: CardVariant;
};

/** Shared card/surface layer. Omit variant for default; set variant for glass | soft | gradient | outline | glow. */
const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card({ className, variant, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("lp-card lp-motion-card", getCardVariantClass(variant), className)}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardHeader(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("lp-card-header", className)} {...props} />;
});
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(function CardTitle(
  { className, ...props },
  ref
) {
  return <h3 ref={ref} className={cn("font-heading text-base font-semibold tracking-tight text-[color:var(--lp-fg)]", className)} {...props} />;
});
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...props }, ref) {
    return <p ref={ref} className={cn("font-body text-sm text-[rgb(var(--lp-muted))]", className)} {...props} />;
  }
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardContent(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("lp-card-content", className)} {...props} />;
});
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardFooter(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("px-6 pb-6 pt-0", className)} {...props} />;
});
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
