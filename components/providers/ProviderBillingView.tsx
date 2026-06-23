"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import BillingContactForm from "@/components/providers/BillingContactForm";
import type { ProviderBillingBundle } from "@/lib/providers/providerBillingShared";
import {
  buildBillingSummaryCards,
  invoiceStatusLabel,
  providerPlanLabel,
} from "@/lib/providers/providerBillingSurface";
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
  const t = useTranslations("provider.billing");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sub = bundle.activeSubscription;
  const selected = bundle.invoices.find((i) => i.id === selectedId) ?? null;

  const taxAmount = sub ? sub.monthly_amount * sub.tax_rate : 0;
  const totalAmount = sub ? sub.monthly_amount + taxAmount : 0;

  const summaryCards = buildBillingSummaryCards({ hasActiveSubscription: Boolean(sub) }, (key, values) =>
    t(key, values),
  );

  return (
    <div className="ds-provider-billing">
      <section className="ds-provider-billing-status-grid">
        {summaryCards.map((card) => (
          <article key={card.id} className="ds-card ds-provider-billing-status-card">
            <p className="ds-eyebrow">{card.label}</p>
            <p className="ds-provider-billing-status-card__value">{card.value}</p>
            {card.hint ? <p className="ds-provider-reg-meta">{card.hint}</p> : null}
          </article>
        ))}
      </section>
      <p className="ds-provider-billing-model-note">{t("commissionNote")}</p>

      {sub ? (
        <section className="ds-card ds-provider-billing-summary">
          <p className="ds-eyebrow">{t("agreement.activeEyebrow")}</p>
          <h2 className="ds-h3">{providerPlanLabel(sub.plan, (key, values) => t(key, values))}</h2>
          <dl className="ds-provider-billing-kpis">
            <div>
              <dt>{t("agreement.netPerMonth")}</dt>
              <dd>{formatNok(sub.monthly_amount)}</dd>
            </div>
            <div>
              <dt>{t("agreement.vatLabel", { rate: Math.round(sub.tax_rate * 100) })}</dt>
              <dd>{formatNok(taxAmount)}</dd>
            </div>
            <div>
              <dt>{t("agreement.totalPerMonth")}</dt>
              <dd className="ds-provider-billing-total">{formatNok(totalAmount)}</dd>
            </div>
          </dl>
          <p className="ds-body">
            {t("agreement.invoiceSentTo")} <strong>{sub.billing_email}</strong>
            {sub.billing_org_number
              ? t("agreement.orgNrSuffix", { orgNumber: sub.billing_org_number })
              : ""}
          </p>
          {canEditContact ? <BillingContactForm providerId={providerId} subscription={sub} /> : null}
        </section>
      ) : (
        <section className="ds-card ds-provider-billing-inactive">
          <p className="ds-provider-empty__title">{t("notActivated.title")}</p>
          <p className="ds-body">{t("notActivated.text")}</p>
        </section>
      )}

      <section className="ds-section">
        <h2 className="ds-h3">{t("history.title")}</h2>
        {bundle.invoices.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{t("history.emptyTitle")}</p>
            <p className="ds-provider-empty__text">{t("history.emptyText")}</p>
          </div>
        ) : (
          <>
            <div className="ds-provider-service-area-list">
              {bundle.invoices.map((inv) => (
                <article key={inv.id} className="ds-provider-service-area-row">
                  <div>
                    <h3 className="ds-h4">{formatMonthYearShortNO(inv.invoice_period)}</h3>
                    <p className="ds-provider-reg-meta">{inv.invoice_number ?? t("invoice.noNumber")}</p>
                  </div>
                  <p className="ds-provider-billing-amount">{formatNok(inv.amount_total)}</p>
                  <span className="ds-provider-status-pill">
                    {invoiceStatusLabel(inv.status, (key, values) => t(key, values))}
                  </span>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary"
                    onClick={() => setSelectedId(inv.id)}
                  >
                    {t("actions.details")}
                  </button>
                </article>
              ))}
            </div>
            <div className="ds-provider-reg-table-wrap ds-provider-reg-table-wrap--desktop">
              <table className="ds-provider-reg-table">
                <thead>
                  <tr>
                    <th>{t("invoice.table.period")}</th>
                    <th>{t("invoice.table.amount")}</th>
                    <th>{t("invoice.table.status")}</th>
                    <th>{t("invoice.table.dueDate")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bundle.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{formatMonthYearLongNO(inv.invoice_period)}</td>
                      <td>{formatNok(inv.amount_total)}</td>
                      <td>
                        <span className="ds-provider-status-pill">
                          {invoiceStatusLabel(inv.status, (key, values) => t(key, values))}
                        </span>
                      </td>
                      <td>{inv.due_date ? formatDateNO(inv.due_date) : t("format.emDash")}</td>
                      <td>
                        <button
                          type="button"
                          className="ds-btn ds-btn--secondary"
                          onClick={() => setSelectedId(inv.id)}
                        >
                          {t("actions.details")}
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
            aria-label={t("actions.closeDrawer")}
            onClick={() => setSelectedId(null)}
          />
          <div className="ds-provider-dialog" role="dialog" aria-modal="true">
            <h2 className="ds-h3">
              {t("invoice.drawerTitle", { number: selected.invoice_number ?? "" })}
            </h2>
            <p className="ds-body">{formatMonthYearLongNO(selected.invoice_period)}</p>
            <dl className="ds-provider-reg-detail">
              <div>
                <dt>{t("invoice.net")}</dt>
                <dd>{formatNok(selected.amount_net)}</dd>
              </div>
              <div>
                <dt>{t("invoice.vat")}</dt>
                <dd>{formatNok(selected.amount_tax)}</dd>
              </div>
              <div>
                <dt>{t("invoice.total")}</dt>
                <dd>{formatNok(selected.amount_total)}</dd>
              </div>
              <div>
                <dt>{t("invoice.status")}</dt>
                <dd>{invoiceStatusLabel(selected.status, (key, values) => t(key, values))}</dd>
              </div>
              {selected.sent_at ? (
                <div>
                  <dt>{t("invoice.sent")}</dt>
                  <dd>{formatDateNO(selected.sent_at)}</dd>
                </div>
              ) : null}
              {selected.paid_at ? (
                <div>
                  <dt>{t("invoice.paid")}</dt>
                  <dd>{formatDateNO(selected.paid_at)}</dd>
                </div>
              ) : null}
            </dl>
            <button
              type="button"
              className="ds-btn ds-btn--secondary"
              disabled
              title={t("invoice.downloadPdfIntegrationTitle")}
            >
              {t("invoice.downloadPdfSoon")}
            </button>
            <button type="button" className="ds-btn ds-btn--primary" onClick={() => setSelectedId(null)}>
              {t("actions.close")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
