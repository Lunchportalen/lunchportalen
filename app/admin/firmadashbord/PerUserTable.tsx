import type { CompanyOrderSummaryPayload } from "@/lib/admin/companyOrderSummaryTypes";
import { formatNokFromCents } from "@/lib/admin/companyOrderDisplay";

export function PerUserTable({ users }: { users: CompanyOrderSummaryPayload["per_user"] }) {
  const rows = [...users].sort((a, b) => b.gross_cents_inc_vat - a.gross_cents_inc_vat);

  return (
    <section className="lp-company-dash-table-section" aria-labelledby="lp-company-dash-table-heading">
      <h2 id="lp-company-dash-table-heading" className="lp-company-dash-h2">
        Per ansatt
      </h2>
      <p className="lp-company-dash-table-intro ds-admin-card__sub">Sortert etter total inkl. MVA (synkende).</p>
      <div className="lp-admin-data-table-wrap">
        <table className="lp-admin-data-table">
          <thead>
            <tr>
              <th scope="col">Ansatt</th>
              <th scope="col" className="lp-admin-data-table__num">
                Ordrer
              </th>
              <th scope="col" className="lp-admin-data-table__num">
                Inkl. MVA
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="lp-admin-data-table__empty">
                  Ingen aktive bestillinger i valgt periode.
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.display_name}</td>
                  <td className="lp-admin-data-table__num">{u.active_order_count}</td>
                  <td className="lp-admin-data-table__num">{formatNokFromCents(u.gross_cents_inc_vat)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
