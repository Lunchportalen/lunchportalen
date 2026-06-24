"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  deleteCustomer,
  pauseCustomer,
  resumeCustomer,
  suspendCustomer,
  type CustomerActionResult,
} from "@/app/leverandor/kunder/actions";
import SuspendDialog, { type SuspendDialogVariant } from "@/components/providers/SuspendDialog";
import type { ProviderCustomerDetail } from "@/lib/providers/loadProviderCustomerDetail";
import { providerCustomerStatusLabelKey } from "@/lib/providers/customerTypes";
import {
  agreementPackageLabel,
  buildAgreementDisplay,
  hasMultipleActiveAgreements,
  sortAgreementsForDisplay,
} from "@/lib/providers/providerCustomerAgreementSurface";
import {
  buildBillingBasisBadges,
  buildBillingBasisDisplay,
  buildCustomerIdentityDisplay,
} from "@/lib/providers/providerCustomerDetailSurface";
import { resolveProviderCustomerActionError } from "@/lib/providers/providerCustomerActionErrors";
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

function formatNokCompact(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(
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
  const locale = useLocale();
  const dateLocale = locale.startsWith("en") ? "en-GB" : "nb-NO";
  const tDetail = useTranslations("provider.customers.detail");
  const tStatus = useTranslations("provider.customers.status");
  const tAgreement = useTranslations("provider.customers.agreement");
  const tActivity = useTranslations("provider.customers.activity");
  const tErrors = useTranslations("provider.customers.errors");
  const tBilling = useTranslations("provider.customers.billing");
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>({ open: false, variant: "suspend" });
  const [agreementEditOpen, setAgreementEditOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState(detail.company.status);

  const translators = useMemo(
    () => ({
      tDetail: (key: string, values?: Record<string, string | number>) => tDetail(key, values),
      tStatus: (key: "active" | "paused" | "suspended" | "deleted") => tStatus(key),
      tAgreementStatus: (key: string) => tAgreement(`status.${key}`),
    }),
    [tDetail, tStatus, tAgreement],
  );

  const company = detail.company;
  const displayStatus = optimisticStatus;
  const isSuspended = displayStatus === "SUSPENDED" || Boolean(company.suspendedAt);
  const isPaused = displayStatus === "PAUSED" || Boolean(company.pausedAt);
  const isDeleted = displayStatus === "DELETED" || Boolean(company.deletedAt);

  const activeAgreement =
    detail.agreements.find((a) => String(a.status).toUpperCase() === "ACTIVE") ?? detail.agreements[0] ?? null;

  const agreementLevel = activeAgreement
    ? agreementPackageLabel(activeAgreement.dayMenus, activeAgreement.tier, (key, values) =>
        tAgreement(key, values),
      )
    : tAgreement("packageMissing");

  const identity = buildCustomerIdentityDisplay(
    {
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
    },
    translators,
  );
  const billingDisplay = buildBillingBasisDisplay(
    detail.billingBasis,
    detail.invoice,
    (key, values) => tDetail(key, values),
    (key) => tBilling(key),
  );
  const billingBadges = buildBillingBasisBadges(detail.billingBasis, (key, values) => tDetail(key, values));

  const employeePreview = useMemo(
    () => detail.employees.slice(0, EMPLOYEE_PREVIEW_LIMIT),
    [detail.employees],
  );

  const historicalOrdersBadge =
    detail.stats.historicalOrdersCount === 1
      ? tDetail("badges.oneHistorical")
      : tDetail("badges.historical", { count: detail.stats.historicalOrdersCount });

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
          <p className="ds-eyebrow">{tDetail("eyebrow")}</p>
          <div className="ds-provider-customer-command__title-row">
            <h1 className="ds-h2">{company.name}</h1>
            <span className={statusBadgeClass(displayStatus)}>
              {tStatus(providerCustomerStatusLabelKey(displayStatus))}
            </span>
          </div>
          <dl className="ds-provider-customer-command__meta">
            <div>
              <dt>{tDetail("meta.orgnr")}</dt>
              <dd>{identity.orgnrLabel}</dd>
            </div>
            <div>
              <dt>{tDetail("meta.invoiceMethod")}</dt>
              <dd>{billingDisplay.methodLabel}</dd>
            </div>
            <div>
              <dt>{tDetail("meta.agreementLevel")}</dt>
              <dd>{agreementLevel}</dd>
            </div>
          </dl>
        </div>

        <div className="ds-admin-kpi-row ds-provider-customer-command__kpis">
          <div className="ds-admin-kpi">
            <div className="ds-admin-kpi__label">{tDetail("kpis.employees")}</div>
            <div className="ds-admin-kpi__value">{detail.stats.employeesCount}</div>
          </div>
          <div className="ds-admin-kpi">
            <div className="ds-admin-kpi__label">{tDetail("kpis.activeOrders")}</div>
            <div className="ds-admin-kpi__value">{detail.stats.activeOrdersCount}</div>
          </div>
          <div className="ds-admin-kpi">
            <div className="ds-admin-kpi__label">{tDetail("kpis.orderHistory")}</div>
            <div className="ds-admin-kpi__value">{detail.stats.historicalOrdersCount}</div>
          </div>
          <div className="ds-admin-kpi">
            <div className="ds-admin-kpi__label">{tDetail("kpis.revenue30Days")}</div>
            <div className="ds-admin-kpi__value">{formatNokCompact(detail.stats.monthlyRevenueNok, dateLocale)}</div>
          </div>
          <div className="ds-admin-kpi">
            <div className="ds-admin-kpi__label">{tDetail("kpis.commission5")}</div>
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
              {tDetail("actions.editAgreement")}
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
                {tDetail("actions.pause")}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--ghost"
                disabled={pending || isDeleted}
                onClick={() => setDialog({ open: true, variant: "suspend" })}
              >
                {tDetail("actions.suspend")}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--ghost"
                disabled={pending || isDeleted}
                onClick={() => setDialog({ open: true, variant: "delete" })}
              >
                {tDetail("actions.removeCustomer")}
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--secondary"
                disabled={pending || (!isSuspended && !isPaused && !isDeleted)}
                onClick={() => setDialog({ open: true, variant: "resume" })}
              >
                {tDetail("actions.restore")}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {isSuspended || isPaused ? (
        <section className="ds-section ds-cta-band ds-cta-band--theme-dark" role="status">
          <p className="ds-body">
            {isSuspended
              ? company.suspendedReason || tDetail("statusBanner.suspendedDefault")
              : company.pausedReason || tDetail("statusBanner.pausedDefault")}
          </p>
        </section>
      ) : null}

      {!canManage ? <p className="ds-body ds-section">{tDetail("readOnly")}</p> : null}

      <section className="ds-section ds-provider-detail-section ds-provider-customer-identity">
        <h2 className="ds-h2">{tDetail("identityTitle")}</h2>
        <article className="ds-card ds-provider-identity-card">
          <dl className="ds-provider-reg-detail ds-provider-identity-grid">
            <div>
              <dt>{tDetail("labels.orgnr")}</dt>
              <dd>{identity.orgnrLabel}</dd>
            </div>
            <div>
              <dt>{tDetail("meta.status")}</dt>
              <dd>{identity.statusLabel}</dd>
            </div>
            <div>
              <dt>{tDetail("labels.contact")}</dt>
              <dd>{identity.contactName}</dd>
            </div>
            <div>
              <dt>{tDetail("labels.email")}</dt>
              <dd>{identity.contactEmail}</dd>
            </div>
            <div>
              <dt>{tDetail("labels.phone")}</dt>
              <dd>{identity.contactPhone}</dd>
            </div>
            <div>
              <dt>{tDetail("labels.deliveryAddress")}</dt>
              <dd>{identity.deliveryAddress}</dd>
            </div>
            <div>
              <dt>{tDetail("labels.agreementStatus")}</dt>
              <dd>{identity.agreementStatusLabel}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="ds-section">
        <div className="ds-provider-section-head">
          <h2 className="ds-h2">{tAgreement("sectionTitle")}</h2>
        </div>
        {success ? (
          <p className="ds-provider-success" role="status">
            {success}
          </p>
        ) : null}
        {detail.agreements.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{tAgreement("empty.title")}</p>
            <p className="ds-provider-empty__text">{tAgreement("empty.text")}</p>
          </div>
        ) : (
          <>
            {hasMultipleActiveAgreements(detail.agreements) ? (
              <p className="ds-provider-agreement-warning" role="status">
                {tAgreement("multipleActiveWarning")}
              </p>
            ) : null}
            {sortAgreementsForDisplay(detail.agreements).map((row) => {
              const display = buildAgreementDisplay(
                row,
                detail.locations,
                (key, values) => tAgreement(key, values),
                dateLocale,
              );
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
                      <dt>{tAgreement("labels.created")}</dt>
                      <dd>{display.createdLabel}</dd>
                    </div>
                    {display.periodLabel ? (
                      <div>
                        <dt>{tAgreement("labels.period")}</dt>
                        <dd>{display.periodLabel}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>{tAgreement("labels.dayMenus")}</dt>
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
                      <dt>{tAgreement("labels.location")}</dt>
                      <dd className="ds-provider-delivery-address">{display.locationLabel}</dd>
                    </div>
                    {!display.packageIsMissing ? (
                      <div>
                        <dt>{tAgreement("labels.package")}</dt>
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
        title={tDetail("billingBasisTitle")}
        badges={[billingBadges.ordersBadge, billingBadges.commissionBadge]}
        defaultOpen
      >
        <article className="ds-provider-billing-panel">
          <div className="ds-provider-billing-panel__status">
            <span className="ds-provider-billing-panel__status-label">{tDetail("labels.billingStatus")}</span>
            <span className="ds-provider-billing-panel__status-value">{billingDisplay.statusLabel}</span>
          </div>
          <div className="ds-provider-billing-panel__grid">
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.period")}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.periodLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.ordersThisMonth")}</span>
              <span className="ds-provider-billing-panel__value">
                {billingDisplay.ordersLabel} {tDetail("badges.ordersSuffix")}
              </span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.revenueExVat")}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.revenueExVatLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.vat")}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.vatLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row ds-provider-billing-panel__row--emphasis">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.revenueIncVat")}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.revenueIncVatLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.commissionBase")}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.commissionBaseLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row ds-provider-billing-panel__row--emphasis">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.commission")}</span>
              <span className="ds-provider-billing-panel__value">
                {billingDisplay.commissionAmountLabel} ({billingDisplay.commissionRateLabel})
              </span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.invoiceMethod")}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.methodLabel}</span>
            </div>
            <div className="ds-provider-billing-panel__row">
              <span className="ds-provider-billing-panel__label">{tDetail("labels.invoiceRecipient")}</span>
              <span className="ds-provider-billing-panel__value">{billingDisplay.recipientLabel}</span>
            </div>
          </div>
          {billingDisplay.note ? (
            <p className="ds-provider-billing-panel__note">{billingDisplay.note}</p>
          ) : null}
          {billingDisplay.confidence === "incomplete" ? (
            <p className="ds-provider-billing-panel__note">{tDetail("billingIncomplete")}</p>
          ) : null}
        </article>
      </ProviderDetailAccordionSection>

      <ProviderDetailAccordionSection
        title={tDetail("sections.employees")}
        badges={[String(detail.stats.employeesCount)]}
        defaultOpen={detail.employees.length > 0 && detail.employees.length <= 3}
      >
        {detail.employees.length === 0 ? (
          <p className="ds-body">{tDetail("sections.employeesEmpty")}</p>
        ) : (
          <div className="ds-provider-customer-list ds-provider-customer-list--desktop">
            <table className="ds-provider-customer-table">
              <thead>
                <tr>
                  <th scope="col">{tDetail("employeesTable.name")}</th>
                  <th scope="col">{tDetail("employeesTable.email")}</th>
                  <th scope="col">{tDetail("employeesTable.role")}</th>
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

      <ProviderDetailAccordionSection title={tDetail("sections.orders")} badges={[historicalOrdersBadge]}>
        {detail.orders.length === 0 ? (
          <p className="ds-body">{tDetail("sections.ordersEmpty")}</p>
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
                      {new Intl.NumberFormat(dateLocale, { style: "currency", currency: "NOK" }).format(order.totalNok)}
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
        title={tDetail("sections.activity")}
        badges={detail.activity.length > 0 ? [String(detail.activity.length)] : undefined}
      >
        {detail.activity.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{tActivity("empty.title")}</p>
            <p className="ds-provider-empty__text">{tActivity("empty.text")}</p>
          </div>
        ) : (
          <div className="ds-provider-activity">
            {detail.activity.map((row) => (
              <article key={row.id} className="ds-provider-activity__row">
                <div className="ds-provider-activity__action">
                  {tActivity(`events.${row.eventKey}.title`)}
                </div>
                <div className="ds-provider-activity__meta">{row.timestamp}</div>
                <p className="ds-body ds-provider-activity__meta--desktop">
                  {tActivity(`events.${row.eventKey}.summary`)}
                </p>
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
          setSuccess(message ?? tDetail("actions.agreementUpdated"));
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
