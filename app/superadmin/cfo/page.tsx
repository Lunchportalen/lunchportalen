// app/superadmin/cfo/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import CfoClient from "./CfoClient";

export default async function SuperadminCfoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <header className="mb-6">
        <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">CFO-dashboard</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Omsetning, stabilitet og kontroll for valgt periode. Tall er kun basert på ordredata.
        </p>
      </header>

      <section className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <CfoClient />
      </section>
    </main>
  );
}
