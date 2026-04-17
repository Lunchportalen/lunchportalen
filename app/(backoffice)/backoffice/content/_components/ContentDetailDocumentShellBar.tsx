"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { useBellissimaWorkspaceModel } from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import type {
  ContentBellissimaWorkspaceActionDescriptor,
  ContentBellissimaWorkspaceModel,
} from "@/lib/cms/backofficeWorkspaceContextModel";

/**
 * Rekkefølge i bunnstripe: preview → save → publish (+ øvrige primære id-er).
 * `preview` = eksisterende workspace-forhåndsvisning (ingen egen «save+preview»-API).
 */
const DETAIL_BOTTOM_PRIMARY_ORDER: readonly string[] = [
  "preview",
  "save",
  "publish",
  "public_page",
  "settings",
];

function sortDetailPrimaryActions(
  actions: readonly ContentBellissimaWorkspaceActionDescriptor[],
): ContentBellissimaWorkspaceActionDescriptor[] {
  const rank = (id: string) => {
    const i = DETAIL_BOTTOM_PRIMARY_ORDER.indexOf(id);
    return i === -1 ? 99 : i;
  };
  return [...actions].sort((a, b) => rank(a.id) - rank(b.id));
}

/**
 * Bellissima legger normalt `publish` i `primaryActionIds` når `canPublish` er true.
 * Hvis den likevel mangler i `primaryActions` men finnes i secondary/entity (fremtidig/kant),
 * vises samme descriptor her uten å endre handlers.
 */
function buildDetailBottomBarActions(
  model: ContentBellissimaWorkspaceModel,
): ContentBellissimaWorkspaceActionDescriptor[] {
  const merged: ContentBellissimaWorkspaceActionDescriptor[] = [...model.primaryActions];
  const have = new Set(merged.map((a) => a.id));
  if (!have.has("publish")) {
    const fromSecondary = model.secondaryActions.find((a) => a.id === "publish");
    const fromEntity = model.entityActions.find((a) => a.id === "publish");
    const pub = fromSecondary ?? fromEntity;
    if (pub) merged.push(pub);
  }
  return sortDetailPrimaryActions(merged);
}

/** Visuell hierarki — samme onSelect/href som descriptor. */
function detailBottomActionSurfaceClasses(
  action: ContentBellissimaWorkspaceActionDescriptor,
): string {
  const secondaryBase =
    "inline-flex min-h-11 min-w-[7rem] items-center justify-center rounded-md border-2 border-slate-500/45 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:border-slate-600 hover:bg-slate-50 sm:min-w-[7.5rem] sm:px-5";
  switch (action.id) {
    case "publish":
      return "inline-flex min-h-12 min-w-[8.5rem] items-center justify-center rounded-md border-2 border-emerald-900/40 bg-[#168a3e] px-6 text-base font-bold tracking-tight text-white shadow-md transition-colors hover:bg-[#147536] sm:min-w-[9.5rem] sm:px-8";
    case "save":
      return secondaryBase;
    case "preview":
      return `${secondaryBase} border-slate-500/40 bg-slate-100/90 text-slate-900`;
    default:
      if (action.tone === "warning") {
        return `${secondaryBase} border-amber-400/80 bg-amber-50 text-amber-950 hover:bg-amber-100`;
      }
      if (action.tone === "danger") {
        return `${secondaryBase} border-red-600/50 bg-red-600 text-white hover:bg-red-700`;
      }
      return `${secondaryBase} bg-slate-100/90`;
  }
}

function PrimaryActionBtn({ action }: { action: ContentBellissimaWorkspaceActionDescriptor }) {
  const classes = detailBottomActionSurfaceClasses(action);

  const proofAttr =
    action.id === "publish"
      ? { "data-lp-publish-action": "true" as const }
      : action.id === "unpublish"
        ? { "data-lp-unpublish-action": "true" as const }
        : action.id === "save"
          ? { "data-lp-save-action": "true" as const }
          : {};

  if (action.href) {
    return (
      <Link href={action.href} className={classes} {...proofAttr}>
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={!action.enabled}
      onClick={() => void action.onSelect?.()}
      className={`${classes} disabled:cursor-not-allowed disabled:opacity-50`}
      {...proofAttr}
    >
      {action.label}
    </button>
  );
}

/** Dokument-handlinger — Umbraco-lignende bunnstripe (Bellissima-descriptors). */
export function ContentDetailDocumentPrimaryBar() {
  const model = useBellissimaWorkspaceModel();
  const sorted = useMemo(() => {
    if (!model || model.snapshot?.viewScope !== "entity") return [];
    return buildDetailBottomBarActions(model);
  }, [model]);

  if (!model || model.snapshot?.viewScope !== "entity") return null;
  if (sorted.length === 0) return null;

  const publishIndex = sorted.findIndex((a) => a.id === "publish");

  return (
    <div
      className="shrink-0 border-t-2 border-slate-400/55 bg-[#d4d8df] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]"
      data-lp-content-detail-document-actions="true"
      data-lp-content-detail-document-actions-tier="primary"
    >
      <div className="flex min-h-[3.75rem] min-w-0 flex-wrap items-center justify-end gap-3 px-4 py-3 sm:min-h-[4rem] sm:gap-3.5 sm:px-6 sm:py-3.5">
        {sorted.map((action, i) => (
          <Fragment key={`${action.id}-${action.placement}`}>
            {publishIndex > 0 && i === publishIndex ? (
              <span
                className="mx-0.5 hidden h-11 w-px shrink-0 bg-slate-500/40 sm:inline-block"
                aria-hidden
              />
            ) : null}
            <PrimaryActionBtn action={action} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
