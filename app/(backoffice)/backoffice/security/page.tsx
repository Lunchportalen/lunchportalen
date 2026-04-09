export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { PageContainer } from "@/components/layout/PageContainer";
import { fetchSecurityDashboardData } from "@/lib/security/dashboardAudit";

import { SecurityDashboardClient } from "./_components/SecurityDashboardClient";

export default async function BackofficeSecurityPage() {
  const { events, metrics, loadError } = await fetchSecurityDashboardData(100);

  return (
    <PageContainer className="max-w-[1440px] py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sikkerhet</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Kun lesing av audit. Ingen mutasjoner. Tilgang begrenset til superadmin via backoffice-layout.
      </p>

      <div className="mt-8">
        <SecurityDashboardClient initialEvents={events} metrics={metrics} loadError={loadError} />
      </div>
    </PageContainer>
  );
}
