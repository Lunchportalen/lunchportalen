import type { ReactNode } from "react";

import { TECHNICAL_DETAILS_SUMMARY } from "@/lib/admin/companyAdminCopy";

type Row = { label: string; value: ReactNode };

type Props = {
  rows: Row[];
  summary?: string;
  className?: string;
};

export default function AdminTechnicalDetails({ rows, summary = TECHNICAL_DETAILS_SUMMARY, className }: Props) {
  if (rows.length === 0) return null;

  return (
    <details className={className}>
      <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--lp-text))]">{summary}</summary>
      <dl className="mt-3 space-y-2 text-sm text-[rgb(var(--lp-text))]">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0 text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">{row.label}</dt>
            <dd className="min-w-0 break-all font-mono text-xs">{row.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
