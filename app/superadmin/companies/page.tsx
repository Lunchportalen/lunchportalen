// app/superadmin/companies/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import CompaniesClient from "./companies-client";
export default async function SuperadminCompaniesPage() {
  return (
    <main className="lp-select-text mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Firma</h1>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Administrer firma, status og avtaler uten avbrudd.
          </p>
        </div>
      </header>

      <CompaniesClient />
    </main>
  );
}
