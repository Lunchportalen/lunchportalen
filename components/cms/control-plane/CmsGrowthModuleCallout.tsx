import Link from "next/link";

import { CONTROL_PLANE_RUNTIME_MODULES } from "@/lib/cms/controlPlaneRuntimeStatusData";
import { getGrowthModuleLivePosture, isNonBroadLivePosture } from "@/lib/cms/moduleLivePosture";

const GROWTH_IDS = new Set(["seo", "social", "esg"]);

type CmsGrowthModuleCalloutProps = {
  moduleId: "seo" | "social" | "esg";
};

/**
 * Felles control-plane-språk + CP6 live-posture (ærlig — ikke «alltid grønt»).
 */
export function CmsGrowthModuleCallout({ moduleId }: CmsGrowthModuleCalloutProps) {
  const m = CONTROL_PLANE_RUNTIME_MODULES.find((x) => x.id === moduleId);
  const lock = getGrowthModuleLivePosture(moduleId);
  if (!m || !GROWTH_IDS.has(m.id)) return null;

  const strict = lock && isNonBroadLivePosture(lock.posture);
  const barClass = strict
    ? "border-amber-500/40 bg-amber-950/35"
    : "border-white/10 bg-black/25";

  return (
    <div
      className={`shrink-0 border-b px-4 py-3 text-xs leading-relaxed text-[rgb(var(--lp-muted))] ${barClass}`}
      role="status"
    >
      <span className="font-semibold text-[rgb(var(--lp-fg))]">Control plane</span> · {m.label}{" "}
      <span className="font-mono text-[10px] text-white/70">{m.badge}</span>
      {lock ? (
        <>
          <span className="mx-1 text-white/30">·</span>
          <span className="font-mono text-[10px] text-white/80">{lock.posture}</span>
          <span className="mx-1 text-white/30">—</span>
          <span>{lock.note}</span>
        </>
      ) : (
        <>
          <span className="mx-1 text-white/30">·</span>
          {m.detail}
        </>
      )}
      {strict ? (
        <span className="mt-1 block text-amber-100/90">
          Ikke behandl denne modulen som full bred live-publisering uten å lese posture over.
        </span>
      ) : null}{" "}
      <Link className="ml-1 font-medium text-[rgb(var(--lp-fg))] underline underline-offset-4" href="/backoffice/domains">
        Domeneoversikt
      </Link>
      {" · "}
      <Link className="font-medium text-[rgb(var(--lp-fg))] underline underline-offset-4" href="/backoffice/content">
        Innhold
      </Link>
      {" · "}
      <Link className="font-medium text-[rgb(var(--lp-fg))] underline underline-offset-4" href="/backoffice/media">
        Media
      </Link>
    </div>
  );
}
