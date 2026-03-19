import type { ReactNode } from "react";

type PageSectionProps = {
  title?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  variant?: "default" | "plain";
};

export default function PageSection({ title, subtitle, right, children, variant = "default" }: PageSectionProps) {
  const shellClass = variant === "plain" ? "" : "lp-card lp-card--elevated p-6";
  return (
    <section className={shellClass}>
      {title || subtitle || right ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-[color:var(--lp-fg)]">{title}</h1> : null}
            {subtitle ? <p className="font-body mt-1 text-sm lp-muted">{subtitle}</p> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      {children ? <div>{children}</div> : null}
    </section>
  );
}
