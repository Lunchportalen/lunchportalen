"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  PROVIDER_ORDERS_DATE_MODES,
  PROVIDER_ORDERS_STATUS_FILTERS,
  ordersStatusFilterKey,
  type KitchenStatusCounts,
} from "@/lib/providers/providerOrdersSurface";

type CompanyOption = { id: string; name: string };

export default function KitchenFilters({
  companies,
  statusCounts,
}: {
  companies: CompanyOption[];
  statusCounts?: KitchenStatusCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("provider.orders.filters");

  const dateMode = searchParams.get("date") ?? "today";
  const status = searchParams.get("status") ?? "";
  const companyId = searchParams.get("company") ?? "";
  const group = searchParams.get("group") ?? "company";

  const push = useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="ds-provider-kitchen-filters" aria-busy={pending}>
      <div className="ds-provider-kitchen-filters__row" role="group" aria-label={t("dateGroupAria")}>
        {PROVIDER_ORDERS_DATE_MODES.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`ds-btn ds-btn--ghost ds-btn--sm${dateMode === d.id ? " is-active" : ""}`}
            aria-pressed={dateMode === d.id}
            onClick={() => push({ date: d.id })}
          >
            {t(`date.${d.id}`)}
          </button>
        ))}
      </div>

      <div className="ds-provider-kitchen-filters__row" role="group" aria-label={t("statusGroupAria")}>
        {PROVIDER_ORDERS_STATUS_FILTERS.map((s) => (
          <button
            key={s.id || "all"}
            type="button"
            className={`ds-provider-status-pill${status === s.id ? " is-active" : ""}`}
            aria-pressed={status === s.id}
            onClick={() => push({ status: s.id })}
          >
            {t(`status.${ordersStatusFilterKey(s.id)}`)}
            {statusCounts ? (
              <span className="ds-provider-status-pill__count">{statusCounts[s.id] ?? 0}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="ds-provider-kitchen-filters__row">
        <label className="ds-provider-kitchen-filters__select">
          <span className="ds-eyebrow">{t("companyLabel")}</span>
          <select
            className="ds-admin-search"
            value={companyId}
            onChange={(e) => push({ company: e.target.value })}
            aria-label={t("companyAria")}
          >
            <option value="">{t("companyAll")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label={t("groupingAria")} className="ds-provider-kitchen-filters__row">
          <button
            type="button"
            className={`ds-btn ds-btn--ghost ds-btn--sm${group === "company" ? " is-active" : ""}`}
            aria-pressed={group === "company"}
            onClick={() => push({ group: "company" })}
          >
            {t("groupByCompany")}
          </button>
          <button
            type="button"
            className={`ds-btn ds-btn--ghost ds-btn--sm${group === "slot" ? " is-active" : ""}`}
            aria-pressed={group === "slot"}
            onClick={() => push({ group: "slot" })}
          >
            {t("groupByTime")}
          </button>
        </div>
      </div>
    </div>
  );
}
