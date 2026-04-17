import Link from "next/link";
import type { ReactNode } from "react";
import {
  backofficeSettingsFlowLabel,
  backofficeSettingsHonestyLabel,
  backofficeSettingsKindLabel,
  backofficeSettingsObjectClassLabel,
  type BackofficeManagementWorkspaceModel,
} from "@/lib/cms/backofficeSettingsWorkspaceModel";

function actionClass(look: "primary" | "secondary" | "outline" | undefined): string {
  if (look === "primary") {
    return "inline-flex min-h-11 items-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800";
  }
  if (look === "secondary") {
    return "inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100";
  }
  return "inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50";
}

function signalToneClass(tone: "neutral" | "success" | "warning" | undefined): string {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-white text-slate-900";
}

export function BackofficeManagementWorkspaceFrame({
  model,
  children,
}: {
  model: BackofficeManagementWorkspaceModel;
  children: ReactNode;
}) {
  return (
    <div className="space-y-8 p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-slate-200/90 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            CMS innstillinger · {model.collection.groupLabel}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
            {model.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            {model.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
              {backofficeSettingsKindLabel(model.routeKind)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {backofficeSettingsHonestyLabel(model.collection.honesty)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {backofficeSettingsObjectClassLabel(model.collection.objectClass)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {backofficeSettingsFlowLabel(model.collection.flowKind)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {model.secondaryActions.map((action) => (
            <Link key={`${action.href}:${action.label}`} href={action.href} className={actionClass(action.look)}>
              {action.label}
            </Link>
          ))}
          {model.primaryAction ? (
            <Link href={model.primaryAction.href} className={actionClass(model.primaryAction.look)}>
              {model.primaryAction.label}
            </Link>
          ) : null}
        </div>
      </header>

      {model.signals.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-3" aria-label="Management-signaler">
          {model.signals.map((signal) => (
            <article
              key={`${signal.label}:${signal.value}`}
              className={`rounded-2xl border p-5 shadow-sm ${signalToneClass(signal.tone)}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-current/70">
                {signal.label}
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-current">{signal.value}</p>
              {signal.description ? (
                <p className="mt-2 text-sm leading-relaxed text-current/80">{signal.description}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {model.relatedLinks.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Relaterte arbeidsflater
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {model.relatedLinks.map((link) => (
              <Link key={`${link.href}:${link.label}`} href={link.href} className={actionClass(link.look)}>
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {model.note ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-700">
          {model.note}
        </section>
      ) : null}

      <div className="space-y-6">{children}</div>
    </div>
  );
}
