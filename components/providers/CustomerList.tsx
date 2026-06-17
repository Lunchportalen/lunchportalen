"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import ProviderCustomerRemovalDialog from "@/components/providers/ProviderCustomerRemovalDialog";

import {
  providerCustomerStatusLabel,
  type ProviderCustomerFilter,
  type ProviderCustomerRow,
  type ProviderCustomersPage,
} from "@/lib/providers/customerTypes";
import {
  PROVIDER_CUSTOMERS_COPY,
  PROVIDER_CUSTOMER_FILTERS,
  buildCustomersPaginationModel,
  formatProviderCustomerUpdated,
  providerCustomersEmptyState,
} from "@/lib/providers/providerCustomersSurface";

function statusBadgeClass(status: ProviderCustomerRow["status"]) {
  if (status === "ACTIVE") return "ds-provider-status-badge ds-provider-status-badge--active";
  if (status === "PAUSED") return "ds-provider-status-badge ds-provider-status-badge--paused";
  if (status === "SUSPENDED") return "ds-provider-status-badge ds-provider-status-badge--suspended";
  return "ds-provider-status-badge ds-provider-status-badge--deleted";
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
  const emptyState = providerCustomersEmptyState({ hasSearch: Boolean(search.trim()), filter });
  const pagination = buildCustomersPaginationModel({
    currentPage: initial.currentPage,
    totalPages: initial.totalPages,
    totalCount: initial.totalCount,
  });
  const copy = PROVIDER_CUSTOMERS_COPY;

  return (
    <div className="ds-section">
      <div className="ds-provider-list-toolbar">
        <label className="ds-provider-list-toolbar__search">
          <span className="ds-eyebrow">{copy.searchLabel}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={copy.searchPlaceholder}
            className="ds-admin-search"
            onChange={(e) => pushParams({ q: e.target.value, page: "1" })}
          />
        </label>
        <div className="ds-provider-list-toolbar__filters" role="group" aria-label={copy.statusGroupAria}>
          {PROVIDER_CUSTOMER_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`ds-btn ds-btn--ghost ds-btn--sm${filter === f.id ? " is-active" : ""}`}
              aria-pressed={filter === f.id}
              disabled={pending}
              onClick={() => pushParams({ filter: f.id, page: "1" })}
            >
              {f.label}
              <span className="ds-provider-filter-count">{initial.statusCounts?.[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <Link href="/leverandor/kunder/ny" className="ds-btn ds-btn--secondary" title={copy.ctaTitle}>
          {copy.cta}
        </Link>
      </div>

      <div className="ds-provider-customer-list ds-provider-customer-list--desktop" aria-busy={pending}>
        <table className="ds-provider-customer-table">
          <thead>
            <tr>
              <th scope="col">{copy.tableHeaders.name}</th>
              <th scope="col">{copy.tableHeaders.status}</th>
              <th scope="col">{copy.tableHeaders.employees}</th>
              <th scope="col">{copy.tableHeaders.ordersThisWeek}</th>
              <th scope="col">{copy.tableHeaders.lastUpdated}</th>
              {canManage ? <th scope="col" className="text-right">Handlinger</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="ds-provider-reg-empty">
                  {emptyState.title}
                  <span className="ds-provider-reg-meta">{emptyState.text}</span>
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
                  <td>
                    <span className={statusBadgeClass(row.status)}>{providerCustomerStatusLabel(row.status)}</span>
                  </td>
                  <td>{row.employeesCount}</td>
                  <td>{row.ordersThisWeek}</td>
                    <td>{formatProviderCustomerUpdated(row.updatedAt, locale)}</td>
                    {canManage ? (
                      <td className="text-right">
                        <button
                          type="button"
                          className="ds-btn ds-btn--ghost ds-btn--sm min-h-12"
                          onClick={() => setRemovalTarget({ id: row.id, name: row.name, orgnr: null })}
                        >
                          Fjern kunde
                        </button>
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
            <p className="ds-provider-empty__title">{emptyState.title}</p>
            <p className="ds-provider-empty__text">{emptyState.text}</p>
          </div>
        ) : (
          rows.map((row) => (
            <Link key={row.id} href={`/leverandor/kunder/${row.id}`} className="ds-card ds-provider-customer-card">
              <div className="ds-card__title">{row.name}</div>
              <span className={statusBadgeClass(row.status)}>{providerCustomerStatusLabel(row.status)}</span>
              <p className="ds-card__text">{copy.mobileMeta(row.employeesCount, row.ordersThisWeek)}</p>
              <p className="ds-provider-activity__meta">
                {copy.mobileUpdatedPrefix} {formatProviderCustomerUpdated(row.updatedAt, locale)}
              </p>
            </Link>
          ))
        )}
      </div>

      <nav className="ds-provider-pagination" aria-label={copy.paginationAria}>
        {pagination.showControls ? (
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--sm"
            disabled={pagination.prevDisabled || pending}
            onClick={() => pushParams({ page: String(page - 1) })}
          >
            {copy.paginationPrev}
          </button>
        ) : null}
        <span className="ds-body ds-provider-pagination__summary">{pagination.summary}</span>
        {pagination.showControls ? (
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--sm"
            disabled={pagination.nextDisabled || pending}
            onClick={() => pushParams({ page: String(page + 1) })}
          >
            {copy.paginationNext}
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
    </div>
  );
}
