// app/superadmin/cto/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import CtoClient from "./CtoClient";

export default async function SuperadminCtoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <header className="mb-6">
        <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">AI CTO</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Regelbasert prioritering ut fra ordre, leads og aktivitet. Tall er forklarbare; ingen skjult modell.
        </p>
      </header>

      <section className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <CtoClient />
      </section>
    </main>
  );
}
