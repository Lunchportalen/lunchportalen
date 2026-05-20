"use client";

import { useState } from "react";

import BillingContactForm from "@/components/providers/BillingContactForm";
import {
  INVOICE_STATUS_LABELS,
  PLAN_LABELS,
  type ProviderBillingBundle,
} from "@/lib/providers/providerBillingShared";
import { formatDateNO, formatMonthYearLongNO, formatMonthYearShortNO } from "@/lib/date/format";

function formatNok(amount: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(amount);
}

export default function ProviderBillingView({
  bundle,
  providerId,
  canEditContact,
}: {
  bundle: ProviderBillingBundle;
  providerId: string;
  canEditContact: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sub = bundle.activeSubscription;
  const selected = bundle.invoices.find((i) => i.id === selectedId) ?? null;

  const taxAmount = sub ? sub.monthly_amount * sub.tax_rate : 0;
  const totalAmount = sub ? sub.monthly_amount + taxAmount : 0;

  return (
    <div className="ds-provider-billing">
      {sub ? (
        <section className="ds-card ds-provider-billing-summary">
          <p className="ds-eyebrow">Aktiv lisens</p>
          <h2 className="ds-h3">{PLAN_LABELS[sub.plan] ?? sub.plan}</h2>
          <dl className="ds-provider-billing-kpis">
            <div>
              <dt>Netto / mnd</dt>
              <dd>{formatNok(sub.monthly_amount)}</dd>
            </div>
            <div>
              <dt>MVA ({Math.round(sub.tax_rate * 100)}%)</dt>
              <dd>{formatNok(taxAmount)}</dd>
            </div>
            <div>
              <dt>Totalt / mnd</dt>
              <dd className="ds-provider-billing-total">{formatNok(totalAmount)}</dd>
            </div>
          </dl>
          <p className="ds-body">
            Faktura sendes til <strong>{sub.billing_email}</strong>
            {sub.billing_org_number ? ` · org.nr ${sub.billing_org_number}` : ""}
          </p>
          {canEditContact ? <BillingContactForm providerId={providerId} subscription={sub} /> : null}
        </section>
      ) : (
        <section className="ds-card">
          <p className="ds-body">
            Ingen aktiv SaaS-lisens er registrert ennå. Kontakt Lunchportalen for å aktivere fakturering.
          </p>
        </section>
      )}

      <section className="ds-section">
        <h2 className="ds-h3">Fakturahistorikk</h2>
        {bundle.invoices.length === 0 ? (
          <p className="ds-body">Ingen fakturaer generert ennå.</p>
        ) : (
          <>
            <div className="ds-provider-service-area-list">
              {bundle.invoices.map((inv) => (
                <article key={inv.id} className="ds-provider-service-area-row">
                  <div>
                    <h3 className="ds-h4">{formatMonthYearShortNO(inv.invoice_period)}</h3>
                    <p className="ds-provider-reg-meta">{inv.invoice_number ?? "Uten nummer"}</p>
                  </div>
                  <p className="ds-provider-billing-amount">{formatNok(inv.amount_total)}</p>
                  <span className="ds-provider-status-pill">{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</span>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary"
                    onClick={() => setSelectedId(inv.id)}
                  >
                    Detaljer
                  </button>
                </article>
              ))}
            </div>
            <div className="ds-provider-reg-table-wrap ds-provider-reg-table-wrap--desktop">
              <table className="ds-provider-reg-table">
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>Beløp</th>
                    <th>Status</th>
                    <th>Forfall</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bundle.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{formatMonthYearLongNO(inv.invoice_period)}</td>
                      <td>{formatNok(inv.amount_total)}</td>
                      <td>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</td>
                      <td>{inv.due_date ? formatDateNO(inv.due_date) : "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="ds-btn ds-btn--secondary"
                          onClick={() => setSelectedId(inv.id)}
                        >
                          Detaljer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {selected ? (
        <>
          <button
            type="button"
            className="ds-provider-drawer-backdrop"
            aria-label="Lukk"
            onClick={() => setSelectedId(null)}
          />
          <div className="ds-provider-dialog" role="dialog" aria-modal="true">
            <h2 className="ds-h3">Faktura {selected.invoice_number ?? ""}</h2>
            <p className="ds-body">{formatMonthYearLongNO(selected.invoice_period)}</p>
            <dl className="ds-provider-reg-detail">
              <div>
                <dt>Netto</dt>
                <dd>{formatNok(selected.amount_net)}</dd>
              </div>
              <div>
                <dt>MVA</dt>
                <dd>{formatNok(selected.amount_tax)}</dd>
              </div>
              <div>
                <dt>Totalt</dt>
                <dd>{formatNok(selected.amount_total)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{INVOICE_STATUS_LABELS[selected.status] ?? selected.status}</dd>
              </div>
              {selected.sent_at ? (
                <div>
                  <dt>Sendt</dt>
                  <dd>{formatDateNO(selected.sent_at)}</dd>
                </div>
              ) : null}
              {selected.paid_at ? (
                <div>
                  <dt>Betalt</dt>
                  <dd>{formatDateNO(selected.paid_at)}</dd>
                </div>
              ) : null}
            </dl>
            <button type="button" className="ds-btn ds-btn--secondary" disabled title="Kommer med Tripletex">
              Last ned PDF (kommer snart)
            </button>
            <button type="button" className="ds-btn ds-btn--primary" onClick={() => setSelectedId(null)}>
              Lukk
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
