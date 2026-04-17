"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useBellissimaWorkspaceModel,
} from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { BackofficeWorkspaceViewTabs } from "@/components/backoffice/BackofficeWorkspaceViewTabs";
import { BellissimaEntityActionMenu } from "@/components/backoffice/BellissimaEntityActionMenu";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import type { ContentBellissimaWorkspaceActionDescriptor } from "@/lib/cms/backofficeWorkspaceContextModel";

function WorkspaceActionButton({
  action,
}: {
  action: ContentBellissimaWorkspaceActionDescriptor;
}) {
  const classes = [
    "inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium transition",
    action.look === "primary" && action.tone === "positive"
      ? "bg-green-600 text-white hover:bg-green-700"
      : action.look === "primary"
        ? "bg-zinc-900 text-white hover:bg-black"
        : action.tone === "warning"
          ? "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
          : action.tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
  ].join(" ");

  if (action.href) {
    return (
      <Link href={action.href} className={classes}>
        {action.label}
      </Link>
    );
  }

  const proofAttr =
    action.id === "publish"
      ? { "data-lp-publish-action": "true" as const }
      : action.id === "unpublish"
        ? { "data-lp-unpublish-action": "true" as const }
        : action.id === "save"
          ? { "data-lp-save-action": "true" as const }
          : {};

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

export function BellissimaWorkspaceHeader() {
  const model = useBellissimaWorkspaceModel();
  const snapshot = model?.snapshot ?? null;
  const pathname = usePathname() ?? "";
  const isContentDetailRoute = resolveBackofficeContentRoute(pathname).kind === "detail";
  if (!model || !snapshot) return null;
  const tabs = model.views.map((view) => ({
    id: view.id,
    href: view.href ?? undefined,
    label: view.label,
    exact: view.exact,
    active: view.active,
    description: view.description,
    onClick: view.onSelect,
  }));
  const visibleActionIds = new Set([
    ...model.primaryActions.map((action) => action.id),
    ...model.secondaryActions.map((action) => action.id),
  ]);
  const overflowEntityActions = model.entityActions.filter((action) => {
    if (action.id === "edit" && snapshot.activeWorkspaceView === "content") return false;
    return !visibleActionIds.has(action.id);
  });
  /** Én kompakt dokumentstatus — øvrige signaler (governance, runtime, panel, …) ligger i inspector/layout. */
  const chips = (
    snapshot.publishState !== "not_applicable"
      ? [
          {
            id: "publish",
            label: snapshot.publishState === "published" ? "Publisert" : "Kladd",
            className:
              snapshot.publishState === "published"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-slate-100 text-slate-700",
          },
        ]
      : []
  ) as { id: string; label: string; className: string }[];

  return (
    <header className="border-b border-[rgb(var(--lp-border))] bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col gap-3 px-4 py-3 lg:px-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="space-y-1">
            {isContentDetailRoute && snapshot.viewScope === "entity" ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Side</p>
                {snapshot.slug ? (
                  <p className="text-sm text-zinc-500">/{snapshot.slug.replace(/^\/+/, "")}</p>
                ) : null}
              </div>
            ) : (
              <>
                <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950">
                  {snapshot.title}
                </h1>
                {snapshot.subtitle ? (
                  <p className="max-w-4xl text-sm text-zinc-600">
                    {snapshot.subtitle}
                  </p>
                ) : null}
                {snapshot.slug ? (
                  <p className="text-sm text-zinc-500">
                    /{snapshot.slug.replace(/^\/+/, "")}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  className={`rounded-full px-3 py-1 ${chip.className}`}
                  {...(chip.id === "publish"
                    ? {
                        "data-lp-publish-state":
                          snapshot.publishState === "published"
                            ? "published"
                            : snapshot.publishState === "draft"
                              ? "draft"
                              : "not_applicable",
                      }
                    : {})}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-start gap-3 xl:justify-end">
          {model.secondaryActions.map((action) => (
            <WorkspaceActionButton key={action.id} action={action} />
          ))}
          {model.primaryActions.map((action) => (
            <WorkspaceActionButton key={action.id} action={action} />
          ))}
          {snapshot.viewScope === "entity" && overflowEntityActions.length > 0 ? (
            <BellissimaEntityActionMenu actions={overflowEntityActions} />
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-3 lg:px-6">
        <BackofficeWorkspaceViewTabs
          items={tabs}
          ariaLabel="Content workspace views"
        />
      </div>
    </header>
  );
}