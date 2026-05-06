import { getControlPlaneRuntimeModules } from "@/lib/cms/controlPlaneRuntimeStatus";
import type { RuntimeModuleBadge } from "@/lib/cms/controlPlaneRuntimeStatusData";

function badgeSurface(b: RuntimeModuleBadge): string {
  switch (b) {
    case "LIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "LIMITED":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "DRY_RUN":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "STUB":
      return "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-alt))] text-[rgb(var(--lp-muted))]";
    default:
      return "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]";
  }
}

function badgeLabel(b: RuntimeModuleBadge): string {
  if (b === "LIVE") return "Live";
  if (b === "LIMITED") return "Begrenset";
  if (b === "DRY_RUN") return "Test";
  if (b === "STUB") return "Ikke aktiv";
  return b;
}

export default function CmsRuntimeStatusStrip() {
  const modules = getControlPlaneRuntimeModules();

  return (
    <details
      className="group shrink-0 rounded-2xl border border-[rgb(var(--lp-border))]/75 bg-[rgba(var(--lp-surface-rgb),0.78)] text-[11px] leading-snug text-[rgb(var(--lp-muted))] shadow-[var(--lp-shadow-sm)] backdrop-blur-sm"
      aria-label="Runtime-modulstatus"
    >
      <summary className="min-h-11 cursor-pointer list-none px-4 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="font-semibold tracking-wide text-[rgb(var(--lp-text))]">Runtime-status</span>
        <span className="text-[rgb(var(--lp-muted))]"> · {modules.length} moduler</span>
      </summary>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-2 pt-0">
        {modules.map((m) => {
          const badgeText = badgeLabel(m.badge);
          return (
            <span
              key={m.id}
              title={m.detail}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${badgeSurface(m.badge)}`}
            >
              <span className="truncate">{m.label}</span>
              <span className="text-[10px] opacity-95">{badgeText}</span>
            </span>
          );
        })}
      </div>
    </details>
  );
}
