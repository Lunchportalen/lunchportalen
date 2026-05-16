// app/admin/firmadashbord/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardHeader } from "./DashboardHeader";
import { KpiCards } from "./KpiCards";
import { PerUserTable } from "./PerUserTable";
import { fetchCompanyOrderSummary } from "@/lib/admin/fetchCompanyOrderSummary";
import { readCompanyDisplayName } from "@/lib/admin/readCompanyDisplayName";
import { resolveCompanyDashboardPeriod } from "@/lib/admin/resolveCompanyDashboardPeriod";
import { getAuthContext } from "@/lib/auth/getAuthContext";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function FirmadashbordPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      redirect("/login?code=NO_SESSION");
    }
    redirect("/login?code=NO_SESSION");
  }

  const role = safeStr(auth.role);
  if (role === "superadmin") {
    redirect("/superadmin");
  }
  if (role !== "company_admin") {
    redirect("/admin");
  }

  const companyId = safeStr(auth.company_id);
  if (!companyId) {
    redirect("/admin");
  }

  let period: { start: string; end: string };
  try {
    period = resolveCompanyDashboardPeriod({ start: sp?.start, end: sp?.end });
  } catch {
    redirect("/admin/firmadashbord");
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
              <Link className="ds-admin-error__link" href="/admin/firmadashbord">
                Prøv på nytt uten egendefinert periode
              </Link>
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
