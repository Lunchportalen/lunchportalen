export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { PageContainer } from "@/components/layout/PageContainer";
import { loadControlPlaneRuntimeSnapshot } from "@/lib/cms/backoffice/loadControlPlaneRuntimeSnapshot";

export default async function BackofficeRuntimeOverviewPage() {
  const snap = await loadControlPlaneRuntimeSnapshot();

  return (
    <PageContainer className="max-w-[1440px] py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Runtime — operativ sannhet</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">
        Kontrollplan viser aggregater fra databasen. Endringer av firma, avtaler og lokasjoner skjer fortsatt i
        superadmin-/admin-flater med eksisterende API og sporbarhet — ikke via duplikat CMS-lag.
      </p>

      {snap.ok === false ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Kunne ikke laste snapshot: {snap.message}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Firma (totalt)</h2>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{snap.companies.total}</p>
            <p className="mt-1 text-xs text-slate-600">
              Aktiv {snap.companies.active} · Venter {snap.companies.pending} · Pause {snap.companies.paused} · Stengt{" "}
              {snap.companies.closed}
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lokasjoner</h2>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{snap.locations}</p>
            <p className="mt-1 text-xs text-slate-600">`company_locations` (runtime)</p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktive avtaler</h2>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{snap.activeAgreements}</p>
            <p className="mt-1 text-xs text-slate-600">`company_current_agreement.status = ACTIVE`</p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uke & meny</h2>
            <p className="mt-2 text-sm text-slate-700">
              Se{" "}
              <Link className="font-medium text-slate-900 underline decoration-slate-300" href="/backoffice/week-menu">
                Uke & meny
              </Link>{" "}
              for Sanity-meny og runtime-kjede.
            </p>
          </section>
        </div>
      )}

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Operative tårn</h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
          <li>
            <Link className="underline decoration-slate-300 hover:decoration-slate-600" href="/superadmin/companies">
              Superadmin — firma
            </Link>
          </li>
          <li>
            <Link className="underline decoration-slate-300 hover:decoration-slate-600" href="/superadmin/system">
              Systemhelse
            </Link>
          </li>
          <li>
            <Link className="underline decoration-slate-300 hover:decoration-slate-600" href="/superadmin/invoices">
              Fakturagrunnlag
            </Link>
          </li>
          <li>
            <Link className="underline decoration-slate-300 hover:decoration-slate-600" href="/admin/control-tower">
              Firma admin — kontrolltårn
            </Link>
          </li>
          <li>
            <Link className="underline decoration-slate-300 hover:decoration-slate-600" href="/kitchen">
              Kjøkken
            </Link>
          </li>
          <li>
            <Link className="underline decoration-slate-300 hover:decoration-slate-600" href="/driver">
              Sjåfør
            </Link>
          </li>
        </ul>
      </section>
    </PageContainer>
  );
}
