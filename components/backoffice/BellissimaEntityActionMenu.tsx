"use client";

import Link from "next/link";
import {
  useBellissimaWorkspaceModel,
} from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import type { ContentBellissimaWorkspaceActionDescriptor } from "@/lib/cms/backofficeWorkspaceContextModel";

function ActionItem({ action }: { action: ContentBellissimaWorkspaceActionDescriptor }) {
  const base =
    "flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition";
  const tone =
    action.tone === "danger"
      ? "text-red-700 hover:bg-red-50"
      : action.tone === "warning"
        ? "text-amber-900 hover:bg-amber-50"
      : "text-zinc-700 hover:bg-zinc-100";

  if (action.href) {
    return (
      <Link href={action.href} className={`${base} ${tone}`}>
        <div>
          <div className="font-medium">{action.label}</div>
          {action.description ? (
            <div className="text-xs text-zinc-500">{action.description}</div>
          ) : null}
        </div>
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={!action.enabled}
      onClick={() => void action.onSelect?.()}
      className={`${base} ${tone} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div>
        <div className="font-medium">{action.label}</div>
        {action.description ? (
          <div className="text-xs text-zinc-500">{action.description}</div>
        ) : null}
      </div>
    </button>
  );
}

export function BellissimaEntityActionMenu({
  actions,
  summaryLabel = "Flere handlinger",
  buttonClassName = "",
  panelClassName = "",
}: {
  actions?: readonly ContentBellissimaWorkspaceActionDescriptor[];
  summaryLabel?: string;
  buttonClassName?: string;
  panelClassName?: string;
}) {
  const model = useBellissimaWorkspaceModel();
  const entityActions = actions ?? model?.entityActions ?? [];
  if (!entityActions.length) return null;

  return (
    <details className="relative">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 ${buttonClassName}`.trim()}
      >
        {summaryLabel}
      </summary>

      <div
        className={`absolute right-0 z-20 mt-2 min-w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl ${panelClassName}`.trim()}
      >
        {entityActions.map((action) => (
          <ActionItem key={action.id} action={action} />
        ))}
      </div>
    </details>
  );
}