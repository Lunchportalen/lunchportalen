"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import ProviderCustomerRemovalDialog from "@/components/providers/ProviderCustomerRemovalDialog";
import ProviderCustomerRestoreDialog from "@/components/providers/ProviderCustomerRestoreDialog";

import {
  providerCustomerStatusLabelKey,
  type ProviderCustomerFilter,
  type ProviderCustomerRow,
  type ProviderCustomersPage,
} from "@/lib/providers/customerTypes";
import { formatInvoiceMethodPresentation } from "@/lib/providers/providerCustomerDetailSurface";
import {
  PROVIDER_CUSTOMER_FILTERS,
  buildCustomersPaginationModel,
  formatProviderCustomerUpdated,
  providerCustomersEmptyStateKeys,
  formatProviderCustomerCount,
  type ProviderCustomersPaginationSummary,
} from "@/lib/providers/providerCustomersSurface";

function statusBadgeClass(status: ProviderCustomerRow["status"]) {
  if (status === "ACTIVE") return "ds-provider-status-badge ds-provider-status-badge--active";
  if (status === "PAUSED") return "ds-provider-status-badge ds-provider-status-badge--paused";
  if (status === "SUSPENDED") return "ds-provider-status-badge ds-provider-status-badge--suspended";
  return "ds-provider-status-badge ds-provider-status-badge--deleted";
}

function formatPaginationSummary(
  t: ReturnType<typeof useTranslations<"provider.customers.pagination">>,
  summary: ProviderCustomersPaginationSummary,
): string {
  if (summary.kind === "single") return t("oneCompany");
  if (summary.kind === "plural") return t("companies", { count: summary.count });
  return t("page", {
    current: summary.currentPage,
    total: summary.totalPages,
    count: summary.totalCount,
  });
}

export default function CustomerList({
  initial,
  locale,
  canManage = false,
}: {
  initial: ProviderCustomersPage;
  locale?: string | null;
  canManage?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [removalTarget, setRemovalTarget] = useState<{ id: string; name: string; orgnr: string | null } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; name: string; orgnr: string | null } | null>(null);
  const tFilters = useTranslations("provider.customers.filters");
  const tStatus = useTranslations("provider.customers.status");
  const tTable = useTranslations("provider.customers.table");
  const tActions = useTranslations("provider.customers.actions");
  const tEmpty = useTranslations("provider.customers.empty");
  const tCard = useTranslations("provider.customers.card");
  const tPagination = useTranslations("provider.customers.pagination");
  const tBilling = useTranslations("provider.customers.billing");

  const formatInvoiceMethod = (methodKey: ProviderCustomerRow["invoiceMethodKey"]) =>
    formatInvoiceMethodPresentation(methodKey, (key) => tBilling(key));

  const filter = (searchParams.get("filter") as ProviderCustomerFilter) || "all";
  const search = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? initial.currentPage) || 1;

  const pushParams = useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const rows = useMemo(() => initial.customers, [initial.customers]);
  const emptyKeys = providerCustomersEmptyStateKeys({ hasSearch: Boolean(search.trim()), filter });
  const pagination = buildCustomersPaginationModel({
    currentPage: initial.currentPage,
    totalPages: initial.totalPages,
    totalCount: initial.totalCount,
  });
  const paginationSummary = formatPaginationSummary(tPagination, pagination.summary);

  return (
    <div className="ds-section">
      <div className="ds-provider-list-toolbar">
        <label className="ds-provider-list-toolbar__search">
          <span className="ds-eyebrow">{tFilters("searchLabel")}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={tFilters("searchPlaceholder")}
            className="ds-admin-search"
            onChange={(e) => pushParams({ q: e.target.value, page: "1" })}
          />
        </label>
        <div className="ds-provider-list-toolbar__filters" role="group" aria-label={tFilters("statusGroupAria")}>
          {PROVIDER_CUSTOMER_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`ds-btn ds-btn--ghost ds-btn--sm${filter === f.id ? " is-active" : ""}`}
              aria-pressed={filter === f.id}
              disabled={pending}
              onClick={() => pushParams({ filter: f.id, page: "1" })}
            >
              {tFilters(f.id)}
              <span className="ds-provider-filter-count">{initial.statusCounts?.[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <Link href="/leverandor/kunder/ny" className="ds-btn ds-btn--secondary" title={tActions("newCustomerTitle")}>
          {tActions("newCustomer")}
        </Link>
      </div>

      <div className="ds-provider-customer-list ds-provider-customer-list--desktop" aria-busy={pending}>
        <table className="ds-provider-customer-table">
          <thead>
            <tr>
              <th scope="col">{tTable("name")}</th>
              <th scope="col">{tTable("orgnr")}</th>
              <th scope="col">{tTable("status")}</th>
              <th scope="col">{tTable("employees")}</th>
              <th scope="col">{tTable("ordersThisWeek")}</th>
              <th scope="col">{tTable("historicalOrders")}</th>
              <th scope="col">{tTable("invoice")}</th>
              <th scope="col">{tTable("lastUpdated")}</th>
              {canManage ? <th scope="col" className="text-right">{tTable("actions")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="ds-provider-reg-empty">
                  {tEmpty(`${emptyKeys.stateKey}.title`)}
                  <span className="ds-provider-reg-meta">{tEmpty(`${emptyKeys.stateKey}.text`)}</span>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/leverandor/kunder/${row.id}`} className="ds-provider-customer-table__link">
                      {row.name}
                    </Link>
                  </td>
                  <td>{row.orgnr ?? "—"}</td>
                  <td>
                    <span className={statusBadgeClass(row.status)}>
                      {tStatus(providerCustomerStatusLabelKey(row.status))}
                    </span>
                  </td>
                  <td>{formatProviderCustomerCount(row.employeesCount)}</td>
                  <td>{formatProviderCustomerCount(row.ordersThisWeek)}</td>
                  <td>{formatProviderCustomerCount(row.historicalOrdersCount)}</td>
                  <td>{formatInvoiceMethod(row.invoiceMethodKey)}</td>
                    <td>{formatProviderCustomerUpdated(row.updatedAt, locale)}</td>
                    {canManage ? (
                      <td className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link href={`/leverandor/kunder/${row.id}`} className="ds-btn ds-btn--ghost ds-btn--sm min-h-12">
                            {tActions("openCustomer")}
                          </Link>
                          {row.status === "DELETED" ? (
                            <button
                              type="button"
                              className="ds-btn ds-btn--secondary ds-btn--sm min-h-12"
                              onClick={() => setRestoreTarget({ id: row.id, name: row.name, orgnr: row.orgnr })}
                            >
                              {tActions("restoreCustomer")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ds-btn ds-btn--ghost ds-btn--sm min-h-12"
                              onClick={() => setRemovalTarget({ id: row.id, name: row.name, orgnr: row.orgnr })}
                            >
                              {tActions("removeCustomer")}
                            </button>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="ds-provider-customer-list ds-provider-customer-list--mobile" aria-busy={pending}>
        {rows.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{tEmpty(`${emptyKeys.stateKey}.title`)}</p>
            <p className="ds-provider-empty__text">{tEmpty(`${emptyKeys.stateKey}.text`)}</p>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="ds-card ds-provider-customer-card">
              <Link href={`/leverandor/kunder/${row.id}`} className="block">
                <div className="ds-card__title">{row.name}</div>
                <span className={statusBadgeClass(row.status)}>
                  {tStatus(providerCustomerStatusLabelKey(row.status))}
                </span>
                <p className="ds-card__text">
                  {tCard("mobileMeta", {
                    employees: formatProviderCustomerCount(row.employeesCount),
                    orders: formatProviderCustomerCount(row.ordersThisWeek),
                    history: formatProviderCustomerCount(row.historicalOrdersCount),
                    invoice: formatInvoiceMethod(row.invoiceMethodKey),
                  })}
                </p>
                {row.orgnr ? (
                  <p className="ds-provider-activity__meta">{tCard("orgNrPrefix", { orgnr: row.orgnr })}</p>
                ) : null}
                <p className="ds-provider-activity__meta">
                  {tCard("mobileUpdatedPrefix")} {formatProviderCustomerUpdated(row.updatedAt, locale)}
                </p>
              </Link>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status === "DELETED" ? (
                    <button
                      type="button"
                      className="ds-btn ds-btn--secondary ds-btn--sm min-h-12"
                      onClick={() => setRestoreTarget({ id: row.id, name: row.name, orgnr: row.orgnr })}
                    >
                      {tActions("restoreCustomer")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ds-btn ds-btn--ghost ds-btn--sm min-h-12"
                      onClick={() => setRemovalTarget({ id: row.id, name: row.name, orgnr: row.orgnr })}
                    >
                      {tActions("removeCustomer")}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <nav className="ds-provider-pagination" aria-label={tPagination("aria")}>
        {pagination.showControls ? (
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--sm"
            disabled={pagination.prevDisabled || pending}
            onClick={() => pushParams({ page: String(page - 1) })}
          >
            {tPagination("prev")}
          </button>
        ) : null}
        <span className="ds-body ds-provider-pagination__summary">{paginationSummary}</span>
        {pagination.showControls ? (
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--sm"
            disabled={pagination.nextDisabled || pending}
            onClick={() => pushParams({ page: String(page + 1) })}
          >
            {tPagination("next")}
          </button>
        ) : null}
      </nav>

      {removalTarget ? (
        <ProviderCustomerRemovalDialog
          open={Boolean(removalTarget)}
          companyId={removalTarget.id}
          companyName={removalTarget.name}
          orgnr={removalTarget.orgnr}
          onClose={() => setRemovalTarget(null)}
          onDone={() => {
            setRemovalTarget(null);
            router.refresh();
          }}
        />
      ) : null}

      {restoreTarget ? (
        <ProviderCustomerRestoreDialog
          open={Boolean(restoreTarget)}
          companyId={restoreTarget.id}
          companyName={restoreTarget.name}
          orgnr={restoreTarget.orgnr}
          onClose={() => setRestoreTarget(null)}
          onDone={() => {
            setRestoreTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
