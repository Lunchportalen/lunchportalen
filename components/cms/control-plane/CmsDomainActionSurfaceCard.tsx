import Link from "next/link";

import type { ControlPlaneDomainActionSurface } from "@/lib/cms/controlPlaneDomainActionSurfaces";

function postureStyle(p: ControlPlaneDomainActionSurface["mutationPosture"]): string {
  switch (p) {
    case "read_only":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "review":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "runtime_route":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    default:
      return "border-slate-200 bg-white text-slate-800";
  }
}

export function CmsDomainActionSurfaceCard({ surface }: { surface: ControlPlaneDomainActionSurface }) {
  return (
    <section
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-labelledby={`das-${surface.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`das-${surface.id}`} className="text-sm font-semibold text-slate-900">
          {surface.title}
        </h2>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${postureStyle(surface.mutationPosture)}`}
          title={surface.postureLabel}
        >
          {surface.postureLabel}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{surface.description}</p>
      {surface.actionRouting?.whyMatters ? (
        <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] leading-relaxed text-slate-800">
          <span className="font-semibold text-slate-900">Hvorfor dette betyr noe:</span> {surface.actionRouting.whyMatters}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">
        <span className="font-medium text-slate-600">Sannhet:</span> {surface.sourceOfTruth}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        <span className="font-medium text-slate-600">CMS:</span>{" "}
        <Link className="text-slate-900 underline" href={surface.cmsSurfaceHref}>
          {surface.cmsSurfaceHref}
        </Link>
      </p>
      {surface.actionRouting ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-700">
          <p>
            <span className="font-semibold text-slate-800">Leser:</span> {surface.actionRouting.reads.join(" · ")}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Skriver:</span> {surface.actionRouting.writes.join(" · ")}
          </p>
          {surface.actionRouting.affects ? (
            <p>
              <span className="font-semibold text-slate-800">Påvirker:</span> {surface.actionRouting.affects}
            </p>
          ) : null}
          {surface.actionRouting.publishControl ? (
            <p>
              <span className="font-semibold text-slate-800">Publish-kontroll:</span> {surface.actionRouting.publishControl}
            </p>
          ) : null}
        </div>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2">
        {surface.actions.map((a) => (
          <li key={`${surface.id}-${a.label}`}>
            {a.external ? (
              <a
                className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                href={a.href}
                target="_blank"
                rel="noreferrer"
              >
                {a.label} ↗
              </a>
            ) : (
              <Link
                className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                href={a.href}
              >
                {a.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
