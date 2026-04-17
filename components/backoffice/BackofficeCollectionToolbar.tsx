"use client";

import type { ReactNode } from "react";

export type BackofficeCollectionToolbarStatusOption = {
  value: string;
  label: string;
};

type BackofficeCollectionToolbarProps = {
  /** F.eks. «Mediabibliotek» — valgfri overskrift for skjermleser. */
  ariaLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  resultHint: string;
  statusFilter?: {
    value: string;
    options: readonly BackofficeCollectionToolbarStatusOption[];
    onChange: (value: string) => void;
  };
  bulkActions?: ReactNode;
};

/**
 * U22 — Felles collection-toolbar (søk + valgfri status + trygge bulk-handlinger).
 */
export function BackofficeCollectionToolbar({
  ariaLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  resultHint,
  statusFilter,
  bulkActions,
}: BackofficeCollectionToolbarProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm"
      role="region"
      aria-label={ariaLabel}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 min-w-[200px] flex-1 rounded border border-slate-200 px-2 text-xs text-slate-900 placeholder:text-slate-400"
          aria-label="Filtrer liste"
        />
        {statusFilter ? (
          <div className="flex flex-wrap gap-1">
            {statusFilter.options.map((opt) => {
              const active = statusFilter.value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => statusFilter.onChange(opt.value)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    active
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <span className="text-[11px] text-slate-500">{resultHint}</span>
      </div>
      {bulkActions ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2" role="group" aria-label="Bulk-handlinger">
          {bulkActions}
        </div>
      ) : null}
    </div>
  );
}
