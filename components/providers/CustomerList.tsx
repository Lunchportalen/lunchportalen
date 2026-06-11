"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import {
  providerCustomerStatusLabel,
  type ProviderCustomerFilter,
  type ProviderCustomerRow,
  type ProviderCustomersPage,
} from "@/lib/providers/customerTypes";

const FILTERS: Array<{ id: ProviderCustomerFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "active", label: "Aktive" },
  { id: "paused", label: "Pauset" },
  { id: "suspended", label: "Suspendert" },
  { id: "deleted", label: "Slettet" },
];

function statusBadgeClass(status: ProviderCustomerRow["status"]) {
  if (status === "ACTIVE") return "ds-provider-status-badge ds-provider-status-badge--active";
  if (status === "PAUSED") return "ds-provider-status-badge ds-provider-status-badge--paused";
  if (status === "SUSPENDED") return "ds-provider-status-badge ds-provider-status-badge--suspended";
  return "ds-provider-status-badge ds-provider-status-badge--deleted";
}

function formatUpdated(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export default function CustomerList({ initial }: { initial: ProviderCustomersPage }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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

  return (
    <div className="ds-section">
      <div className="ds-provider-list-toolbar">
        <label className="ds-provider-list-toolbar__search">
          <span className="ds-eyebrow">Søk</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Firmanavn"
            className="ds-admin-search"
            onChange={(e) => pushParams({ q: e.target.value, page: "1" })}
          />
        </label>
        <div className="ds-provider-list-toolbar__filters" role="group" aria-label="Statusfilter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`ds-btn ds-btn--ghost ds-btn--sm${filter === f.id ? " is-active" : ""}`}
              aria-pressed={filter === f.id}
              disabled={pending}
              onClick={() => pushParams({ filter: f.id, page: "1" })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/leverandor/kunder/ny" className="ds-btn ds-btn--primary">
          Legg til kunde
        </Link>
      </div>

      <div className="ds-provider-customer-list ds-provider-customer-list--desktop" aria-busy={pending}>
        <table className="ds-provider-customer-table">
          <thead>
            <tr>
              <th scope="col">Navn</th>
              <th scope="col">Status</th>
              <th scope="col">Ansatte</th>
              <th scope="col">Ordrer uke</th>
              <th scope="col">Sist endret</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="ds-provider-reg-empty">
                  Ingen kunder matcher valgt filter eller søk.
                  <span className="ds-provider-reg-meta">Juster filteret, eller legg til en ny kunde.</span>
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
                  <td>{formatUpdated(row.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="ds-provider-customer-list ds-provider-customer-list--mobile" aria-busy={pending}>
        {rows.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">Ingen kunder matcher valgt filter eller søk</p>
            <p className="ds-provider-empty__text">Juster filteret, eller legg til en ny kunde.</p>
          </div>
        ) : (
          rows.map((row) => (
            <Link key={row.id} href={`/leverandor/kunder/${row.id}`} className="ds-card ds-provider-customer-card">
              <div className="ds-card__title">{row.name}</div>
              <span className={statusBadgeClass(row.status)}>{providerCustomerStatusLabel(row.status)}</span>
              <p className="ds-card__text">
                {row.employeesCount} ansatte · {row.ordersThisWeek} ordrer denne uken
              </p>
              <p className="ds-provider-activity__meta">Sist endret {formatUpdated(row.updatedAt)}</p>
            </Link>
          ))
        )}
      </div>

      <nav className="ds-provider-pagination" aria-label="Paginering">
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm"
          disabled={page <= 1 || pending}
          onClick={() => pushParams({ page: String(page - 1) })}
        >
          Forrige
        </button>
        <span className="ds-body">
          Side {initial.currentPage} av {initial.totalPages} ({initial.totalCount} totalt)
        </span>
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm"
          disabled={page >= initial.totalPages || pending}
          onClick={() => pushParams({ page: String(page + 1) })}
        >
          Neste
        </button>
      </nav>
    </div>
  );
}
