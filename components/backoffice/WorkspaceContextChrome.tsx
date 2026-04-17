import type { ReactNode } from "react";

import type { WorkspaceStatusChip } from "@/lib/cms/backofficeWorkspaceContextModel";

function chipToneClass(tone: WorkspaceStatusChip["tone"]): string {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  if (tone === "muted") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-slate-200 bg-white text-slate-800";
}

/**
 * U21 — Felles «workspace context»-stripe: hva flaten angår + korte status-chips (Umbraco-lignende kontekst).
 */
export function WorkspaceContextChrome({
  contextSummary,
  statusChips,
}: {
  contextSummary?: ReactNode;
  statusChips?: readonly WorkspaceStatusChip[];
}) {
  if (!contextSummary && !(statusChips && statusChips.length)) return null;

  return (
    <div className="mt-3 grid gap-2">
      {contextSummary ? (
        <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs leading-relaxed text-slate-800 shadow-sm">
          <span className="font-semibold text-slate-900">Kontekst · </span>
          {contextSummary}
        </div>
      ) : null}
      {statusChips && statusChips.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Workspace-status">
          {statusChips.map((c, i) => (
            <li
              key={`${c.label}-${i}`}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${chipToneClass(c.tone)}`}
            >
              {c.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
