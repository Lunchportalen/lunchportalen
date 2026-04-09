export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { BackofficeWorkspaceSurface } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { PageContainer } from "@/components/layout/PageContainer";
import { CmsAgreementRuntimePreviewTable } from "@/components/cms/control-plane/CmsAgreementRuntimePreviewTable";
import { CmsDomainActionSurfaceCard } from "@/components/cms/control-plane/CmsDomainActionSurfaceCard";
import { getDomainActionSurfaceById } from "@/lib/cms/controlPlaneDomainActionSurfaces";
import { loadDomainRuntimeOverview } from "@/lib/cms/backoffice/loadDomainRuntimeOverview";

export default async function BackofficeAgreementRuntimePage() {
  const data = await loadDomainRuntimeOverview();
  const selfSurface = getDomainActionSurfaceById("agreement_runtime");

  if (data.ok === false) {
    return (
      <div data-workspace="agreement-runtime">
        <PageContainer className="max-w-[1440px] py-8">
          <h1 className="text-2xl font-semibold text-slate-900">Avtale — runtime-innsyn</h1>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{data.message}</p>
        </PageContainer>
      </div>
    );
  }

  return (
    <BackofficeWorkspaceSurface
      workspaceId="agreement-runtime"
      title="Avtale"
      lead={
        <>
          Lesing og review av avtalefelt speilet fra <code className="rounded bg-slate-100 px-1">agreement_json</code> der
          normalisering lykkes. Mutasjon skjer i <strong>superadmin</strong> eller <strong>company admin</strong> — ikke her.
        </>
      }
    >
      {selfSurface ? (
        <div className="max-w-xl">
          <CmsDomainActionSurfaceCard surface={selfSurface} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-50"
          href="/superadmin/companies"
        >
          Superadmin — firma
        </Link>
        <Link
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-50"
          href="/admin/agreement"
        >
          Company admin — avtale (eget firma)
        </Link>
        <Link
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-50"
          href="/backoffice/domains"
        >
          Domeneoversikt
        </Link>
      </div>

      <div className="mt-10">
        <CmsAgreementRuntimePreviewTable rows={data.companyRows} />
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Ordre, faktura og leveranser forblir uendret i operative API-er — denne siden er orkestrering og innsyn.
      </p>
    </BackofficeWorkspaceSurface>
  );
}
