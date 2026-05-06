import Link from "next/link";

export type SuperadminCardProps = {
  /** Capability id (for subtle per-card affordances, e.g. "NY") */
  id?: string;
  title: string;
  description?: string;
  href: string;
  /** One visually prioritized row inside the compact capability list. */
  primaryAction?: boolean;
};

export default function SuperadminCard({ id, title, description, href, primaryAction }: SuperadminCardProps) {
  const isNewCapability = id === "ai-social-engine";
  const cardShell =
    primaryAction
      ? "group flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 shadow-sm transition hover:bg-amber-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      : "group flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2.5 transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2";

  return (
    <Link href={href} className={cardShell}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">{title}</h4>
          {isNewCapability ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-950">
              NY
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-[rgb(var(--lp-muted))]">{description}</p> : null}
      </div>
      <span className="shrink-0 text-xs font-semibold text-[rgb(var(--lp-muted))] transition group-hover:text-[rgb(var(--lp-fg))]">Åpne</span>
    </Link>
  );
}
