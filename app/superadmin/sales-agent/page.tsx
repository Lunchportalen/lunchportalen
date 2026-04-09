// app/superadmin/sales-agent/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import SalesAgentClient from "./SalesAgentClient";

export default function SuperadminSalesAgentPage() {
  return (
    <main className="mx-auto max-w-[1440px] pb-12 pt-2 lp-select-text">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Salgsagent</h1>
      <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--lp-muted))]">
        Velger leads fra pipeline, genererer rolige B2B-utkast (AI eller deterministisk fallback). Alt er utkast — ingen
        automatisk utsendelse.
      </p>
      <div className="mt-8">
        <SalesAgentClient />
      </div>
    </main>
  );
}
