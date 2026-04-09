export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { BackofficeWorkspaceSurface } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { PageContainer } from "@/components/layout/PageContainer";
import { CmsCompanyAgreementLocationPanel } from "@/components/cms/control-plane/CmsCompanyAgreementLocationPanel";
import { CmsDomainActionSurfaceCard } from "@/components/cms/control-plane/CmsDomainActionSurfaceCard";
import { getDomainActionSurfaceById } from "@/lib/cms/controlPlaneDomainActionSurfaces";
import { loadDomainRuntimeOverview } from "@/lib/cms/backoffice/loadDomainRuntimeOverview";

export default async function BackofficeCustomersPage() {
  const data = await loadDomainRuntimeOverview();
  const companiesSurface = getDomainActionSurfaceById("companies_customers");

  if (data.ok === false) {
    return (
      <div data-workspace="customers">
        <PageContainer className="max-w-[1440px] py-8">
          <h1 className="text-2xl font-semibold text-slate-900">Kunder & avtaler</h1>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{data.message}</p>
        </PageContainer>
      </div>
    );
  }

  return (
    <BackofficeWorkspaceSurface
      workspaceId="customers"
      title="Kunder"
      lead={
        <>
          Read-only speil av <code className="rounded bg-slate-100 px-1">companies</code> og lokasjonstelling. For endring av avtale,
          status eller binding: bruk superadmin-flyten (samme runtime-sannhet som før).
        </>
      }
    >
      {companiesSurface ? (
        <div className="max-w-2xl">
          <CmsDomainActionSurfaceCard surface={companiesSurface} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-50"
          href="/superadmin/companies"
        >
          Åpne superadmin — firma
        </Link>
        <Link
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-50"
          href="/backoffice/domains"
        >
          Domeneoversikt
        </Link>
      </div>

      <div className="mt-10">
        <CmsCompanyAgreementLocationPanel rows={data.companyRows} />
      </div>
    </BackofficeWorkspaceSurface>
  );
}
