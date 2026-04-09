export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { BackofficeWorkspaceSurface } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { PageContainer } from "@/components/layout/PageContainer";
import { CmsCompanyAgreementLocationPanel } from "@/components/cms/control-plane/CmsCompanyAgreementLocationPanel";
import { CmsDomainActionSurfaceCard } from "@/components/cms/control-plane/CmsDomainActionSurfaceCard";
import { CmsModuleLivePostureTable } from "@/components/cms/control-plane/CmsModuleLivePostureTable";
import { CONTROL_PLANE_DOMAIN_ACTION_SURFACES } from "@/lib/cms/controlPlaneDomainActionSurfaces";
import { loadDomainRuntimeOverview } from "@/lib/cms/backoffice/loadDomainRuntimeOverview";

export default async function BackofficeDomainsPage() {
  const data = await loadDomainRuntimeOverview();

  if (data.ok === false) {
    return (
      <div data-workspace="domains">
        <PageContainer className="max-w-[1440px] py-8">
          <h1 className="text-2xl font-semibold text-slate-900">Domener — kontrollplan</h1>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{data.message}</p>
        </PageContainer>
      </div>
    );
  }

  const { snapshot, companyRows, orders7d, moduleStatuses } = data;

  const pill =
    "inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50";

  return (
    <BackofficeWorkspaceSurface
      workspaceId="domains"
      title="Domener"
      lead={
        <>
          Én oversikt over runtime-tall, modulstatus og firma-innsyn. Mutasjoner skjer fortsatt i dedikerte superadmin/admin-flater —
          dette er orkestrering og lesing.
        </>
      }
      contextSummary={
        <>
          Denne flaten viser <strong className="font-medium text-slate-900">aggregerte runtime-speil</strong> (firma,
          lokasjoner, avtaler, ordre-vindu). Den muterer ikke data — bruk koblede flater for godkjente endringer.
        </>
      }
      statusChips={[
        { label: "Lesing / kontrollplan", tone: "muted" },
        { label: "Runtime-koblet", tone: "warning" },
      ]}
      toolbar={
        <>
          <Link className={pill} href="/backoffice/runtime">
            Runtime-oversikt
          </Link>
          <Link className={pill} href="/backoffice/week-menu">
            Uke & meny
          </Link>
          <Link className={pill} href="/backoffice/content">
            Content
          </Link>
        </>
      }
      secondaryActions={
        <>
          <Link className={`${pill} border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100`} href="/superadmin/companies">
            Superadmin — firma (mutasjon)
          </Link>
        </>
      }
      footerApps={
        <>
          <strong className="font-medium text-slate-900">Footer · historikk & publish:</strong> global strip over viser
          kilder (Postgres vs Sanity). Innholdssider: audit og recovery i Content-workspace — ikke én felles logg for hele
          plattformen.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Firma</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{snapshot.companies.total}</p>
          <p className="mt-1 text-xs text-slate-600">
            Aktiv {snapshot.companies.active} · vent {snapshot.companies.pending}
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lokasjoner</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{snapshot.locations}</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktive avtaler</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{snapshot.activeAgreements}</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordre (7 d)</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{orders7d.total}</p>
          <p className="mt-1 text-xs text-slate-600">
            {orders7d.from} → {orders7d.to}
          </p>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-900">Modulstatus (ærlig)</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {moduleStatuses.map((m) => (
            <li key={m.id} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700" title={m.detail}>
              <span className="font-medium">{m.label}</span> · {m.badge}
            </li>
          ))}
        </ul>
      </section>

      <CmsModuleLivePostureTable />

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-900">Domenehandlinger (read / review / runtime)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Samme mønster overalt: kilde → CMS-flate → trygge handlinger. Ingen ny sannhet i backoffice.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CONTROL_PLANE_DOMAIN_ACTION_SURFACES.map((surface) => (
            <CmsDomainActionSurfaceCard key={surface.id} surface={surface} />
          ))}
        </div>
      </section>

      <div className="mt-10">
        <CmsCompanyAgreementLocationPanel rows={companyRows} caption="Siste oppdaterte firma (maks 48)." />
      </div>

      <p className="mt-8 text-sm text-slate-600">
        Trenger du mutasjon? Gå til{" "}
        <Link className="font-medium text-slate-900 underline" href="/superadmin/companies">
          Superadmin — firma
        </Link>
        .
      </p>
    </BackofficeWorkspaceSurface>
  );
}
