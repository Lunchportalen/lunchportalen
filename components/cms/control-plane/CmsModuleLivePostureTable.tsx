import { MODULE_LIVE_POSTURE_REGISTRY, type ModuleLivePostureKind } from "@/lib/cms/moduleLivePosture";

function postureStyle(p: ModuleLivePostureKind): string {
  switch (p) {
    case "LIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "LIMITED":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "DRY_RUN":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "STUB":
      return "border-rose-200 bg-rose-50 text-rose-950";
    case "INTERNAL_ONLY":
      return "border-violet-200 bg-violet-50 text-violet-950";
    case "DISABLE_FOR_BROAD_LIVE":
      return "border-slate-300 bg-slate-100 text-slate-900";
    default:
      return "border-slate-200 bg-white text-slate-800";
  }
}

/**
 * CP6 — ærlig live-posture-tabell (ikke salg, ikke grønnvasking).
 */
export function CmsModuleLivePostureTable() {
  return (
    <section className="mt-10" aria-labelledby="live-posture-table-heading">
      <h2 id="live-posture-table-heading" className="text-sm font-semibold text-slate-900">
        Modul-posture (CP6 — låst klassifisering)
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Brukes for å unngå at moduler ser «fullt live» ut når de ikke er det. Klassifisering er låst i ett register i
        kodebasen.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-2">Modul</th>
              <th className="px-4 py-2">Posture</th>
              <th className="px-4 py-2">Merknad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MODULE_LIVE_POSTURE_REGISTRY.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 font-medium text-slate-900">{row.label}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] ${postureStyle(row.posture)}`}
                  >
                    {row.posture}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
