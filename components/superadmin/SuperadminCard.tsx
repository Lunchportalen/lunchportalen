import Link from "next/link";

export type SuperadminCardProps = {
  /** Capability id (for subtle per-card affordances, e.g. «NY») */
  id?: string;
  title: string;
  description?: string;
  href: string;
  /** F6: én primær handling får hot-pink mikro-highlight */
  primaryAction?: boolean;
};

export default function SuperadminCard({ id, title, description, href, primaryAction }: SuperadminCardProps) {
  const isNewCapability = id === "ai-social-engine";
  const btnClass = primaryAction
    ? "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-shadow duration-200 hover:shadow-[0_0_0_2px_rgba(255,16,240,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff10f0] focus-visible:ring-offset-2"
    : "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-shadow duration-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2";

  const cardShell =
    isNewCapability
      ? "group flex h-full flex-col rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-5 shadow-sm ring-1 ring-[#ff10f0]/25 transition-transform duration-200 ease-out hover:scale-[1.01] hover:border-[rgb(var(--lp-border))] hover:shadow-md"
      : "group flex h-full flex-col rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-5 shadow-sm transition-transform duration-200 ease-out hover:scale-[1.01] hover:border-[rgb(var(--lp-border))] hover:shadow-md";

  return (
    <div className={cardShell}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">{title}</h3>
        {isNewCapability ? (
          <span className="rounded-full border border-[#ff10f0]/35 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#ff10f0]">
            NY
          </span>
        ) : null}
      </div>
      {description ? <p className="font-body mt-2 flex-1 text-sm text-[rgb(var(--lp-muted))]">{description}</p> : null}
      <div className="mt-4">
        <Link href={href} className={btnClass}>
          Åpne
        </Link>
      </div>
    </div>
  );
}
