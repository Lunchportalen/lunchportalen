import { getControlPlaneRuntimeModules } from "@/lib/cms/controlPlaneRuntimeStatus";
import type { RuntimeModuleBadge } from "@/lib/cms/controlPlaneRuntimeStatusData";

function badgeSurface(b: RuntimeModuleBadge): string {
  switch (b) {
    case "LIVE":
      return "border-emerald-400/35 bg-emerald-500/10 text-emerald-50";
    case "LIMITED":
      return "border-amber-400/35 bg-amber-500/10 text-amber-50";
    case "DRY_RUN":
      return "border-sky-400/35 bg-sky-500/10 text-sky-50";
    case "STUB":
      return "border-rose-400/40 bg-rose-500/10 text-rose-50";
    default:
      return "border-white/20 bg-white/5 text-white/80";
  }
}

export default function CmsRuntimeStatusStrip() {
  const modules = getControlPlaneRuntimeModules();

  return (
    <details
      className="group shrink-0 border-b border-white/10 bg-[rgb(var(--lp-chrome-bg))]/50 text-[11px] leading-snug text-white/85 backdrop-blur-sm"
      aria-label="Runtime-modulstatus"
    >
      <summary className="min-h-11 cursor-pointer list-none px-4 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="font-semibold tracking-wide text-white/95">Kontrollplan · runtime</span>
        <span className="text-white/70"> · {modules.length} moduler (utvid)</span>
      </summary>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-2 pt-0">
        {modules.map((m) => {
          const badgeText = m.badge === "LIVE" ? "Published" : m.badge;
          return (
            <span
              key={m.id}
              title={m.detail}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 ${badgeSurface(m.badge)}`}
            >
              <span className="truncate">{m.label}</span>
              <span className="font-mono text-[10px] opacity-95">{badgeText}</span>
            </span>
          );
        })}
      </div>
    </details>
  );
}
