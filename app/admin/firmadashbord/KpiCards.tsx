import type { CompanyOrderSummaryPayload } from "@/lib/admin/companyOrderSummaryTypes";
import { formatNokFromCents } from "@/lib/admin/companyOrderDisplay";

export function KpiCards({ summary }: { summary: CompanyOrderSummaryPayload }) {
  return (
    <section className="lp-company-dash-kpis" aria-labelledby="lp-company-dash-kpi-heading">
      <h2 id="lp-company-dash-kpi-heading" className="sr-only">
        Nøkkeltall for perioden
      </h2>
      <div className="ds-admin-kpi-row">
        <article className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Bestilte måltider</div>
          <div className="ds-admin-kpi__value">{summary.total_meal_units}</div>
          <div className="ds-admin-kpi__foot">Sum linjer (porsjoner)</div>
        </article>
        <article className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Aktive bestillinger</div>
          <div className="ds-admin-kpi__value">{summary.active_order_count}</div>
          <div className="ds-admin-kpi__foot">Ordre med status ACTIVE</div>
        </article>
        <article className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Total ex. MVA</div>
          <div className="ds-admin-kpi__value">{formatNokFromCents(summary.total_subtotal_cents_ex_vat)}</div>
          <div className="ds-admin-kpi__foot">Etter avtalepriser</div>
        </article>
        <article className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Total inkl. MVA</div>
          <div className="ds-admin-kpi__value">{formatNokFromCents(summary.total_gross_cents_inc_vat)}</div>
          <div className="ds-admin-kpi__foot">Inkludert MVA</div>
        </article>
      </div>
    </section>
  );
}
