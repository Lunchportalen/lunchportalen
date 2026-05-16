import type { CompanyOrderSummaryPayload } from "@/lib/admin/companyOrderSummaryTypes";
import { formatCompanyDashboardPeriodLabel } from "@/lib/admin/companyOrderDisplay";

export function DashboardHeader(p: {
  companyName: string;
  period: { start: string; end: string };
  summary: CompanyOrderSummaryPayload;
}) {
  const { companyName, period, summary } = p;
  const periodLabel = formatCompanyDashboardPeriodLabel(period.start, period.end);

  return (
    <header className="lp-company-dash-header ds-admin-card">
      <div className="ds-admin-card__head">
        <div>
          <p className="ds-eyebrow lp-company-dash-header__eyebrow">Firmaadmin</p>
          <h1 className="ds-admin-card__title lp-company-dash-h1">{companyName}</h1>
          <p className="ds-admin-card__sub lp-company-dash-lead">
            <span className="lp-company-dash-period">{periodLabel}</span>
            <span aria-hidden="true"> · </span>
            <span>{summary.active_order_count} aktive bestillinger i perioden</span>
          </p>
        </div>
      </div>
    </header>
  );
}
