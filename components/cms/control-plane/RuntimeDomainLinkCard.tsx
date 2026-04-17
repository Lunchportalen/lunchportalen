import Link from "next/link";

import type { RuntimeModuleBadge } from "@/lib/cms/controlPlaneRuntimeStatusData";

function badgeSurface(b: RuntimeModuleBadge): string {
  switch (b) {
    case "LIVE":
      return "border-emerald-400/40 bg-emerald-50 text-emerald-900";
    case "LIMITED":
      return "border-amber-400/40 bg-amber-50 text-amber-950";
    case "DRY_RUN":
      return "border-sky-400/40 bg-sky-50 text-sky-950";
    case "STUB":
      return "border-rose-400/40 bg-rose-50 text-rose-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

type RuntimeDomainLinkCardProps = {
  title: string;
  href: string;
  badge: RuntimeModuleBadge;
  description: string;
};

export function RuntimeDomainLinkCard({ title, href, badge, description }: RuntimeDomainLinkCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 group-hover:underline">{title}</h2>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono ${badgeSurface(badge)}`}>{badge}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{description}</p>
    </Link>
  );
}
