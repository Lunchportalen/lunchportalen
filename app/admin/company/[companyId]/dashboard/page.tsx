// app/admin/company/[companyId]/dashboard/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import { DashboardHeader } from "./DashboardHeader";
import { KpiCards } from "./KpiCards";
import { PerUserTable } from "./PerUserTable";
import { fetchCompanyOrderSummary } from "@/lib/admin/fetchCompanyOrderSummary";
import { readCompanyDisplayName } from "@/lib/admin/readCompanyDisplayName";
import { resolveCompanyDashboardPeriod } from "@/lib/admin/resolveCompanyDashboardPeriod";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { roleHome } from "@/lib/auth/roleHome";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
};

export default async function CompanyAdminDashboardPage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const companyId = safeStr(params?.companyId);

  const auth = await getAuthContext();
  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      redirect("/login?code=NO_SESSION");
    }
    redirect("/login?code=NO_SESSION");
  }

  const role = safeStr(auth.role);
  if (role === "company_admin") {
    const scoped = safeStr(auth.company_id);
    if (!scoped) {
      redirect("/admin");
    }
    if (!companyId || companyId !== scoped) {
      redirect(`/admin/company/${scoped}/dashboard`);
    }
  } else if (role === "superadmin") {
    /* RPC håndhever plattform-rollen; layout uten firmaside-meny er forventet. */
  } else {
    redirect(roleHome(role));
  }

  if (!companyId) {
    redirect("/admin");
  }

  let period: { start: string; end: string };
  try {
    period = resolveCompanyDashboardPeriod({ start: searchParams?.start, end: searchParams?.end });
  } catch {
    redirect(`/admin/company/${companyId}/dashboard`);
  }

  let summary: Awaited<ReturnType<typeof fetchCompanyOrderSummary>> | null = null;
  let loadError: string | null = null;

  try {
    summary = await fetchCompanyOrderSummary({
      companyId,
      periodStart: period.start,
      periodEnd: period.end,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Kunne ikke laste sammendrag.";
  }

  const companyName = await readCompanyDisplayName(companyId);

  return (
    <div className="lp-company-dash-page ds-page">
      <div className="ds-container">
        {loadError ? (
          <div className="ds-admin-error" role="alert">
            <h1 className="ds-admin-error__title">Dashbord utilgjengelig</h1>
            <p className="ds-admin-error__body">{loadError}</p>
            <div className="ds-admin-error__actions">
              <a className="ds-admin-error__link" href={`/admin/company/${companyId}/dashboard`}>
                Prøv på nytt uten egendefinert periode
              </a>
            </div>
          </div>
        ) : summary ? (
          <>
            <DashboardHeader companyName={companyName} period={period} summary={summary} />
            <KpiCards summary={summary} />
            <PerUserTable users={summary.per_user} />
          </>
        ) : null}
      </div>
    </div>
  );
}
