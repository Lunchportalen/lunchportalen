"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

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
  agreementPackageLabel,
  buildAgreementDisplay,
  hasMultipleActiveAgreements,
  sortAgreementsForDisplay,
} from "@/lib/providers/providerCustomerAgreementSurface";
import {
  PROVIDER_CUSTOMER_DETAIL_COPY,
  buildBillingBasisBadges,
  buildBillingBasisDisplay,
  buildCustomerIdentityDisplay,
} from "@/lib/providers/providerCustomerDetailSurface";
import { resolveProviderCustomerActionError } from "@/lib/providers/providerCustomerActionErrors";
import { PROVIDER_CUSTOMER_ACTIVITY_EMPTY } from "@/lib/providers/providerCustomerDetailActivity";
import ProviderCustomerAgreementEditDialog from "@/components/providers/ProviderCustomerAgreementEditDialog";
import ProviderDetailAccordionSection from "@/components/providers/ProviderDetailAccordionSection";

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

function formatNokCompact(amount: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(
    amount,
  );
}

const EMPLOYEE_PREVIEW_LIMIT = 10;

export default function CustomerDetailClient({
  detail,
  canManage,
}: {
  detail: ProviderCustomerDetail;
  canManage: boolean;
}) {
  const router = useRouter();
  const tErrors = useTranslations("provider.customers.errors");
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

  const activeAgreement =
    detail.agreements.find((a) => String(a.status).toUpperCase() === "ACTIVE") ?? detail.agreements[0] ?? null;

  const agreementLevel = activeAgreement
    ? agreementPackageLabel(activeAgreement.dayMenus, activeAgreement.tier)
    : PROVIDER_AGREEMENT_COPY.packageMissing;

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
  const billingBadges = buildBillingBasisBadges(detail.billingBasis);

  const employeePreview = useMemo(
    () => detail.employees.slice(0, EMPLOYEE_PREVIEW_LIMIT),
    [detail.employees],
  );

  const historicalOrdersBadge =
    detail.stats.historicalOrdersCount === 1
      ? "1 historisk"
      : `${detail.stats.historicalOrdersCount} historiske`;

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
      if (res.success === false) {
        setOptimisticStatus(prev);
        setError(resolveProviderCustomerActionError((key) => tErrors(key), res));
        return;
      }
      setDialog({ open: false, variant });
      router.refresh();
    });
  }

  return (
    <>
      <header className="ds-provider-customer-command">
        <div className="ds-provider-customer-command__intro">
          <p className="ds-eyebrow">Kunde</p>
          <div className="ds-provider-customer-command__title-row">
            <h1 className="ds-h2">{company.name}</h1>
            <span className={statusBadgeClass(displayStatus)}>{providerCustomerStatusLabel(displayStatus)}</span>
          </div>
          <dl className="ds-provider-customer-command__meta">
            <div>
              <dt>Org.nr</dt>
              <dd>{identity.orgnrLabel}</dd>
            </div>
            <div>
              <dt>Fakturametode</dt>
              <dd>{billingDisplay.methodLabel}</dd>
            </div>
            <div>
              <dt>Avtalenivå</dt>
              <dd>{agreementLevel}</dd>
            </div>
          </dl>
        </div>

        <div className="ds-admin-kpi-row ds-provider-customer-command__kpis">
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
            <div className="ds-admin-kpi__value">{formatNokCompact(detail.stats.monthlyRevenueNok)}</div>
          </div>
          <div className="ds-admin-kpi">
            <div className="ds-admin-kpi__label">Provisjon 5 %</div>
            <div className="ds-admin-kpi__value">{billingDisplay.commissionAmountLabel}</div>
          </div>
        </div>

        <div className="ds-provider-customer-command__actions">
          {canManage && activeAgreement ? (
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={() => {
                setSuccess(null);
                setAgreementEditOpen(true);
              }}
            >
              Endre avtale
            </button>
          ) : null}
          {canManage ? (
            <>
              <button
                type="button"
                className="ds-btn ds-btn--ghost"
                disabled={pending || isDeleted}
                onClick={() => setDialog({ open: true, variant: "pause" })}
              >
                Pause
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--ghost"
                disabled={pending || isDeleted}
                onClick={() => setDialog({ open: true, variant: "suspend" })}
              >
                Suspender
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--ghost"
                disabled={pending || isDeleted}
                onClick={() => setDialog({ open: true, variant: "delete" })}
              >
                Fjern kunde
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--secondary"
                disabled={pending || (!isSuspended && !isPaused && !isDeleted)}
                onClick={() => setDialog({ open: true, variant: "resume" })}
              >
                Gjenopprett
              </button>
            </>
          ) : null}
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

      {!canManage ? (
        <p className="ds-body ds-section">Du har lesetilgang. Endringer krever administratortilgang.</p>
      ) : null}

      <section className="ds-section ds-provider-detail-section ds-provider-customer-identity">
        <h2 className="ds-h2">{PROVIDER_CUSTOMER_DETAIL_COPY.identityTitle}</h2>
        <article className="ds-card ds-provider-identity-card">
          <dl className="ds-provider-reg-detail ds-provider-identity-grid">
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
                        <dd>{display.packageLabel}</dd>
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

      <ProviderDetailAccordionSection
        title={PROVIDER_CUSTOMER_DETAIL_COPY.billingBasisTitle}
        badges={[billingBadges.ordersBadge, billingBadges.commissionBadge]}
        defaultOpen
      >
        <article className="ds-provider-billing-panel">
          <div className="ds-provider-billing-panel__status">
            <span className="ds-provider-billing-panel__status-label">
              {PROVIDER_CUSTOMER_DETAIL_COPY.labels.billingStatus}
            </span>
            <span className="ds-provider-billing-panel__status-value">{billingDisplay.statusLabel}</span>
          </div>
          <div className="ds-provider-billing-panel__grid">
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{PROVIDER_CUSTOMER_DETAIL_COPY.labels.period}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.periodLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">
                {PROVIDER_CUSTOMER_DETAIL_COPY.labels.ordersThisMonth}
              </span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.ordersLabel} ordre</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">
                {PROVIDER_CUSTOMER_DETAIL_COPY.labels.revenueExVat}
              </span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.revenueExVatLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{PROVIDER_CUSTOMER_DETAIL_COPY.labels.vat}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.vatLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row ds-provider-billing-panel__row--emphasis">
              <span className="ds-provider-billing-panel__label">
                {PROVIDER_CUSTOMER_DETAIL_COPY.labels.revenueIncVat}
              </span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.revenueIncVatLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">
                {PROVIDER_CUSTOMER_DETAIL_COPY.labels.commissionBase}
              </span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.commissionBaseLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row ds-provider-billing-panel__row--emphasis">
              <span className="ds-provider-billing-panel__label">
                {PROVIDER_CUSTOMER_DETAIL_COPY.labels.commission}
              </span>
              <span className="ds-provider-billing-panel__value">
                {billingDisplay.commissionAmountLabel} ({billingDisplay.commissionRateLabel})
              </span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">
                {PROVIDER_CUSTOMER_DETAIL_COPY.labels.invoiceMethod}
              </span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.methodLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">
                {PROVIDER_CUSTOMER_DETAIL_COPY.labels.invoiceRecipient}
              </span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.recipientLabel}</span>
            </div>
          </div>
          {billingDisplay.note ? (
            <p className="ds-provider-billing-panel__note">{billingDisplay.note}</p>
          ) : null}
          {billingDisplay.confidence === "incomplete" ? (
            <p className="ds-provider-billing-panel__note">{PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete}</p>
          ) : null}
        </article>
      </ProviderDetailAccordionSection>

      <ProviderDetailAccordionSection
        title="Ansatte"
        badges={[String(detail.stats.employeesCount)]}
        defaultOpen={detail.employees.length > 0 && detail.employees.length <= 3}
      >
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
                {employeePreview.map((employee) => (
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
      </ProviderDetailAccordionSection>

      <ProviderDetailAccordionSection title="Ordrer" badges={[historicalOrdersBadge]}>
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
      </ProviderDetailAccordionSection>

      <ProviderDetailAccordionSection
        title="Aktivitet"
        badges={detail.activity.length > 0 ? [String(detail.activity.length)] : undefined}
      >
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
      </ProviderDetailAccordionSection>

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
