"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteCustomer,
  pauseCustomer,
  resumeCustomer,
  suspendCustomer,
  type CustomerActionResult,
} from "@/app/leverandor/kunder/actions";
import SuspendDialog, { type SuspendDialogVariant } from "@/components/providers/SuspendDialog";
import type { ProviderCustomerDetail } from "@/lib/providers/loadProviderCustomerDetail";
import { providerCustomerStatusLabel } from "@/lib/providers/customerTypes";
import {
  PROVIDER_AGREEMENT_COPY,
  buildAgreementDisplay,
  hasMultipleActiveAgreements,
  sortAgreementsForDisplay,
} from "@/lib/providers/providerCustomerAgreementSurface";
import {
  PROVIDER_CUSTOMER_DETAIL_COPY,
  buildBillingBasisDisplay,
  buildCustomerIdentityDisplay,
} from "@/lib/providers/providerCustomerDetailSurface";
import { PROVIDER_CUSTOMER_ACTIVITY_EMPTY } from "@/lib/providers/providerCustomerDetailActivity";
import ProviderCustomerAgreementEditDialog from "@/components/providers/ProviderCustomerAgreementEditDialog";

type DialogState = {
  open: boolean;
  variant: SuspendDialogVariant;
};

function statusBadgeClass(status: ProviderCustomerDetail["company"]["status"]) {
  if (status === "ACTIVE") return "ds-provider-status-badge ds-provider-status-badge--active";
  if (status === "PAUSED") return "ds-provider-status-badge ds-provider-status-badge--paused";
  if (status === "SUSPENDED") return "ds-provider-status-badge ds-provider-status-badge--suspended";
  return "ds-provider-status-badge ds-provider-status-badge--deleted";
}

export default function CustomerDetailClient({
  detail,
  canManage,
}: {
  detail: ProviderCustomerDetail;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>({ open: false, variant: "suspend" });
  const [agreementEditOpen, setAgreementEditOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState(detail.company.status);

  const company = detail.company;
  const displayStatus = optimisticStatus;
  const isSuspended = displayStatus === "SUSPENDED" || Boolean(company.suspendedAt);
  const isPaused = displayStatus === "PAUSED" || Boolean(company.pausedAt);
  const isDeleted = displayStatus === "DELETED" || Boolean(company.deletedAt);

  const identity = buildCustomerIdentityDisplay({
    companyName: company.name,
    orgnr: company.orgnr,
    status: displayStatus,
    contactName: company.contactName,
    contactEmail: company.contactEmail,
    contactPhone: company.contactPhone,
    locationName: detail.primaryLocationName,
    locationAddress: detail.primaryLocationAddress,
    companyAddress: company.companyAddress,
    activeAgreementStatus: detail.activeAgreementStatus,
  });
  const billingDisplay = buildBillingBasisDisplay(detail.billingBasis, detail.invoice);

  async function runAction(
    variant: SuspendDialogVariant,
    reason?: string,
  ): Promise<CustomerActionResult> {
    if (variant === "suspend") return suspendCustomer(company.id, reason ?? "");
    if (variant === "pause") return pauseCustomer(company.id, reason ?? "");
    if (variant === "delete") return deleteCustomer(company.id, reason ?? "");
    return resumeCustomer(company.id);
  }

  function optimisticFor(variant: SuspendDialogVariant) {
    if (variant === "suspend") return "SUSPENDED" as const;
    if (variant === "pause") return "PAUSED" as const;
    if (variant === "delete") return "DELETED" as const;
    return "ACTIVE" as const;
  }

  function handleConfirm(reason?: string) {
    const variant = dialog.variant;
    const prev = optimisticStatus;
    setOptimisticStatus(optimisticFor(variant));
    setError(null);

    startTransition(async () => {
      const res = await runAction(variant, reason);
      if (!res.success) {
        setOptimisticStatus(prev);
        setError("error" in res ? res.error : "Handlingen feilet.");
        return;
      }
      setDialog({ open: false, variant });
      router.refresh();
    });
  }

  return (
    <>
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Kunde</p>
          <h1 className="ds-h2">{company.name}</h1>
          <span className={statusBadgeClass(displayStatus)}>{providerCustomerStatusLabel(displayStatus)}</span>
        </div>
      </header>

      {isSuspended || isPaused ? (
        <section className="ds-section ds-cta-band ds-cta-band--theme-dark" role="status">
          <p className="ds-body">
            {isSuspended
              ? company.suspendedReason || "Kunden er suspendert."
              : company.pausedReason || "Kunden er pauset."}
          </p>
        </section>
      ) : null}

      <div className="ds-admin-kpi-row ds-section">
        <div className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Ansatte</div>
          <div className="ds-admin-kpi__value">{detail.stats.employeesCount}</div>
        </div>
        <div className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Aktive ordre</div>
          <div className="ds-admin-kpi__value">{detail.stats.activeOrdersCount}</div>
        </div>
        <div className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Ordrehistorikk</div>
          <div className="ds-admin-kpi__value">{detail.stats.historicalOrdersCount}</div>
        </div>
        <div className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Omsetning 30 dager</div>
          <div className="ds-admin-kpi__value">
            {new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(
              detail.stats.monthlyRevenueNok,
            )}
          </div>
        </div>
      </div>

      <div className="ds-provider-action-bar">
        <button
          type="button"
          className="ds-btn ds-btn--ghost"
          disabled={!canManage || pending || isDeleted}
          onClick={() => setDialog({ open: true, variant: "pause" })}
        >
          Pause
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--ghost"
          disabled={!canManage || pending || isDeleted}
          onClick={() => setDialog({ open: true, variant: "suspend" })}
        >
          Suspender
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--ghost"
          disabled={!canManage || pending || isDeleted}
          onClick={() => setDialog({ open: true, variant: "delete" })}
        >
          Slett
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          disabled={!canManage || pending || (!isSuspended && !isPaused && !isDeleted)}
          onClick={() => setDialog({ open: true, variant: "resume" })}
        >
          Gjenopprett
        </button>
      </div>

      {!canManage ? (
        <p className="ds-body ds-section">Du har lesetilgang. Endringer krever administratortilgang.</p>
      ) : null}

      <section className="ds-section ds-provider-detail-section ds-provider-customer-identity">
        <h2 className="ds-h2">{PROVIDER_CUSTOMER_DETAIL_COPY.identityTitle}</h2>
        <article className="ds-card ds-provider-identity-card">
          <p className="ds-h4">{identity.companyName}</p>
          <dl className="ds-provider-reg-detail">
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.orgnr}</dt>
              <dd>{identity.orgnrLabel}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{identity.statusLabel}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.contact}</dt>
              <dd>{identity.contactName}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.email}</dt>
              <dd>{identity.contactEmail}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.phone}</dt>
              <dd>{identity.contactPhone}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.deliveryAddress}</dt>
              <dd>{identity.deliveryAddress}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.agreementStatus}</dt>
              <dd>{identity.agreementStatusLabel}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="ds-section">
        <div className="ds-provider-section-head">
          <h2 className="ds-h2">{PROVIDER_AGREEMENT_COPY.sectionTitle}</h2>
          {canManage && detail.agreements.some((a) => String(a.status).toUpperCase() === "ACTIVE") ? (
            <button
              type="button"
              className="ds-btn ds-btn--secondary"
              onClick={() => {
                setSuccess(null);
                setAgreementEditOpen(true);
              }}
            >
              Endre avtale
            </button>
          ) : null}
        </div>
        {success ? (
          <p className="ds-provider-success" role="status">
            {success}
          </p>
        ) : null}
        {detail.agreements.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{PROVIDER_AGREEMENT_COPY.empty.title}</p>
            <p className="ds-provider-empty__text">{PROVIDER_AGREEMENT_COPY.empty.text}</p>
          </div>
        ) : (
          <>
            {hasMultipleActiveAgreements(detail.agreements) ? (
              <p className="ds-provider-agreement-warning" role="status">
                {PROVIDER_AGREEMENT_COPY.multipleActiveWarning}
              </p>
            ) : null}
            {sortAgreementsForDisplay(detail.agreements).map((row) => {
              const display = buildAgreementDisplay(row, detail.locations);
              return (
                <article key={display.id} className="ds-card ds-provider-agreement-card">
                  <div className="ds-provider-agreement-card__head">
                    <h3 className="ds-h4">{display.title}</h3>
                    <span
                      className={`ds-provider-status-pill${display.statusTone === "success" ? " is-active" : ""}`}
                    >
                      {display.statusLabel}
                    </span>
                  </div>
                  <dl className="ds-provider-reg-detail">
                    <div>
                      <dt>{PROVIDER_AGREEMENT_COPY.labels.created}</dt>
                      <dd>{display.createdLabel}</dd>
                    </div>
                    {display.periodLabel ? (
                      <div>
                        <dt>{PROVIDER_AGREEMENT_COPY.labels.period}</dt>
                        <dd>{display.periodLabel}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>{PROVIDER_AGREEMENT_COPY.labels.dayMenus}</dt>
                      <dd>
                        {display.dayMenusLines.length > 0 ? (
                          <ul className="ds-provider-day-menus">
                            {display.dayMenusLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          display.dayMenusLabel
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{PROVIDER_AGREEMENT_COPY.labels.location}</dt>
                      <dd className="ds-provider-delivery-address">{display.locationLabel}</dd>
                    </div>
                    {display.packageLabel !== PROVIDER_AGREEMENT_COPY.packageMissing ? (
                      <div>
                        <dt>{PROVIDER_AGREEMENT_COPY.labels.package}</dt>
                        <dd>{display.packageLabel} (standard)</dd>
                      </div>
                    ) : null}
                  </dl>
                  {display.deliveryDaysWarning ? (
                    <p className="ds-provider-agreement-warning" role="status">
                      {display.deliveryDaysWarning}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </>
        )}
      </section>

      <section className="ds-section ds-provider-detail-section ds-provider-billing-basis">
        <h2 className="ds-h2">{PROVIDER_CUSTOMER_DETAIL_COPY.billingBasisTitle}</h2>
        <article className="ds-card">
          <dl className="ds-provider-billing-kpis">
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.ordersThisMonth}</dt>
              <dd>{billingDisplay.ordersLabel}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.revenue}</dt>
              <dd>{billingDisplay.revenueLabel}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.commission}</dt>
              <dd>{billingDisplay.commissionLabel}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.invoiceMethod}</dt>
              <dd>{billingDisplay.methodLabel}</dd>
            </div>
            <div>
              <dt>{PROVIDER_CUSTOMER_DETAIL_COPY.labels.invoiceRecipient}</dt>
              <dd>{billingDisplay.recipientLabel}</dd>
            </div>
          </dl>
          {billingDisplay.incomplete ? (
            <p className="ds-body ds-provider-billing-inactive">{PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete}</p>
          ) : null}
        </article>
      </section>

      <section className="ds-section ds-provider-detail-section">
        <h2 className="ds-h2">Ansatte</h2>
        {detail.employees.length === 0 ? (
          <p className="ds-body">Ingen ansatte registrert for denne kunden ennå.</p>
        ) : (
          <div className="ds-provider-customer-list ds-provider-customer-list--desktop">
            <table className="ds-provider-customer-table">
              <thead>
                <tr>
                  <th scope="col">Navn</th>
                  <th scope="col">E-post</th>
                  <th scope="col">Rolle</th>
                </tr>
              </thead>
              <tbody>
                {detail.employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td>{employee.email ?? "—"}</td>
                    <td>{employee.role ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ds-section ds-provider-detail-section">
        <h2 className="ds-h2">Ordrer</h2>
        {detail.orders.length === 0 ? (
          <p className="ds-body">Ingen ordre registrert for denne kunden ennå.</p>
        ) : (
          <ul className="ds-provider-order-history">
            {detail.orders.map((order) => (
              <li key={order.id} className="ds-provider-order-history__item">
                <div className="ds-provider-order-history__head">
                  <span className="ds-provider-order-history__date">{order.date}</span>
                  <span className="ds-provider-order-history__status">{order.status}</span>
                  {order.employeeName ? (
                    <span className="ds-provider-order-history__meta">{order.employeeName}</span>
                  ) : null}
                  {order.totalNok != null ? (
                    <span className="ds-provider-order-history__total">
                      {new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(order.totalNok)}
                    </span>
                  ) : null}
                </div>
                {order.lines.length > 0 ? (
                  <ul className="ds-provider-order-history__lines">
                    {order.lines.map((line, idx) => (
                      <li key={`${order.id}-${idx}`}>{line.displayLine}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ds-section ds-provider-detail-section">
        <h2 className="ds-h2">Aktivitet</h2>
        {detail.activity.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{PROVIDER_CUSTOMER_ACTIVITY_EMPTY.title}</p>
            <p className="ds-provider-empty__text">{PROVIDER_CUSTOMER_ACTIVITY_EMPTY.text}</p>
          </div>
        ) : (
          <div className="ds-provider-activity">
            {detail.activity.map((row) => (
              <article key={row.id} className="ds-provider-activity__row">
                <div className="ds-provider-activity__action">{row.title}</div>
                <div className="ds-provider-activity__meta">{row.timestamp}</div>
                {row.summary ? <p className="ds-body ds-provider-activity__meta--desktop">{row.summary}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <ProviderCustomerAgreementEditDialog
        open={agreementEditOpen}
        companyId={company.id}
        companyName={company.name}
        onClose={() => setAgreementEditOpen(false)}
        onDone={(message) => {
          setSuccess(message ?? "Avtalen er oppdatert.");
          router.refresh();
        }}
      />

      <SuspendDialog
        open={dialog.open}
        variant={dialog.variant}
        entityName={company.name}
        loading={pending}
        error={error}
        onCancel={() => {
          if (!pending) {
            setDialog((d) => ({ ...d, open: false }));
            setError(null);
          }
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
