"use client";

import type { ReactNode } from "react";

type Props = {
  /** Knapp(er) som alltid vises (primær sone). */
  primary: ReactNode;
  /** Sekundære handlinger (support, retry, …) — skjules bak «Mer». */
  secondary: ReactNode;
  /** True når det finnes noe sekundært å vise. */
  hasSecondary: boolean;
  summaryLabel?: string;
};

/**
 * U31 — Bellissima-lignende: én tydelig primær sone, sekundært bak details (mindre støy i header).
 */
export function BackofficeOverflowActionBar({
  primary,
  secondary,
  hasSecondary,
  summaryLabel = "Mer",
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {primary}
      {hasSecondary ? (
        <details className="group relative">
          <summary className="min-h-11 cursor-pointer list-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            {summaryLabel}
          </summary>
          <div className="absolute right-0 z-30 mt-1 flex min-w-[12rem] flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {secondary}
          </div>
        </details>
      ) : null}
    </div>
  );
}
