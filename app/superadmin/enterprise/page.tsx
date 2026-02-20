// app/superadmin/enterprise/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import EnterpriseClient from "./EnterpriseClient";

export default async function SuperadminEnterprisePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <header className="mb-6">
        <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Konsern</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Konsernvisning med tilknyttede selskaper og lokasjoner. Read-only i første fase.
        </p>
      </header>

      <section className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <EnterpriseClient />
      </section>
    </main>
  );
}
