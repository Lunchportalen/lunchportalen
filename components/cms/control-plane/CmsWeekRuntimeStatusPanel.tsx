import Link from "next/link";

type CmsWeekRuntimeStatusPanelProps = {
  studioUrl: string;
};

export function CmsWeekRuntimeStatusPanel({ studioUrl }: CmsWeekRuntimeStatusPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm" aria-labelledby="week-runtime-panel">
      <h2 id="week-runtime-panel" className="text-sm font-semibold text-slate-900">
        Operativ meny-kjede (single chain)
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          <strong>Avtale:</strong> <code className="rounded bg-white px-1">company_current_agreement</code> (ACTIVE) styrer tier og leveringsdager.
        </li>
        <li>
          <strong>Menydata:</strong> Sanity <code className="rounded bg-white px-1">menu</code> / <code className="rounded bg-white px-1">menuContent</code> per dato — lest av{" "}
          <code className="rounded bg-white px-1">GET /api/week</code>.
        </li>
        <li>
          <strong>Redaksjonell ukeplan:</strong> Sanity <code className="rounded bg-white px-1">weekPlan</code> er <strong>ikke</strong> samme som employee-order truth — merket LIMITED.
        </li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-white"
          href={studioUrl}
          target="_blank"
          rel="noreferrer"
        >
          Sanity Studio (meny)
        </a>
        <Link className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-white" href="/backoffice/domains">
          Domeneoversikt
        </Link>
      </div>
    </section>
  );
}
