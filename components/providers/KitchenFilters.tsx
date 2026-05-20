"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

type CompanyOption = { id: string; name: string };

const DATE_MODES = [
  { id: "today", label: "I dag" },
  { id: "tomorrow", label: "I morgen" },
  { id: "week", label: "Hele uken" },
] as const;

const STATUS_FILTERS = [
  { id: "", label: "Alle" },
  { id: "ACTIVE", label: "Mottatt" },
  { id: "PREPARED", label: "Produksjon" },
  { id: "DISPATCHED", label: "Klar" },
  { id: "DELIVERED", label: "Levert" },
] as const;

export default function KitchenFilters({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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
      <div className="ds-provider-kitchen-filters__row" role="group" aria-label="Dato">
        {DATE_MODES.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`ds-btn ds-btn--ghost ds-btn--sm${dateMode === d.id ? " is-active" : ""}`}
            aria-pressed={dateMode === d.id}
            onClick={() => push({ date: d.id })}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="ds-provider-kitchen-filters__row" role="group" aria-label="Status">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.id || "all"}
            type="button"
            className={`ds-provider-status-pill${status === s.id ? " is-active" : ""}`}
            aria-pressed={status === s.id}
            onClick={() => push({ status: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="ds-provider-kitchen-filters__row">
        <label className="ds-provider-kitchen-filters__select">
          <span className="ds-eyebrow">Firma</span>
          <select
            className="ds-admin-search"
            value={companyId}
            onChange={(e) => push({ company: e.target.value })}
            aria-label="Filtrer på firma"
          >
            <option value="">Alle firma</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Gruppering" className="ds-provider-kitchen-filters__row">
          <button
            type="button"
            className={`ds-btn ds-btn--ghost ds-btn--sm${group === "company" ? " is-active" : ""}`}
            aria-pressed={group === "company"}
            onClick={() => push({ group: "company" })}
          >
            Per firma
          </button>
          <button
            type="button"
            className={`ds-btn ds-btn--ghost ds-btn--sm${group === "slot" ? " is-active" : ""}`}
            aria-pressed={group === "slot"}
            onClick={() => push({ group: "slot" })}
          >
            Per tid
          </button>
        </div>
      </div>
    </div>
  );
}
