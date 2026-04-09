// app/superadmin/pipeline/page.tsx — Kanban (superadmin)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import PipelineKanbanClient from "./PipelineKanbanClient";

export default function SuperadminPipelinePage() {
  return (
    <main className="mx-auto max-w-[1440px] pb-12 pt-2 lp-select-text">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Pipeline</h1>
      <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--lp-muted))]">
        Dra avtaler mellom trinn. Oppdateringer lagres i <code className="rounded bg-black/5 px-1">lead_pipeline</code>
        (meta + status).
      </p>
      <div className="mt-8">
        <PipelineKanbanClient />
      </div>
    </main>
  );
}
