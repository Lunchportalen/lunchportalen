"use client";

import Link from "next/link";

import { useBellissimaWorkspaceModel } from "@/components/backoffice/ContentBellissimaWorkspaceContext";

/**
 * U31 — Bellissima «footer apps»: rolig statusstripe under redigerer (ikke flere badges i toppen).
 */
export function BackofficeWorkspaceFooterApps() {
  const model = useBellissimaWorkspaceModel();
  if (!model?.snapshot) return null;
  const identityApps = model.footerApps.filter((app) => app.group === "identity");
  const statusApps = model.footerApps.filter((app) => app.group === "status");
  const shortcutApps = model.footerApps.filter((app) => app.group === "shortcut");

  const toneClassFor = (tone: "neutral" | "success" | "warning") =>
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <footer
      className="font-ui sticky bottom-0 z-10 border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/95 px-4 py-2.5 text-xs text-[rgb(var(--lp-muted))] backdrop-blur-sm"
      aria-label="Arbeidsflate — status og snarveier"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {identityApps.map((app) => (
            <span
              key={app.id}
              title={app.description ?? undefined}
              className="rounded-full border border-[rgb(var(--lp-border))] bg-white px-2.5 py-1 font-medium text-[rgb(var(--lp-text))]"
            >
              {app.label}: {app.value}
            </span>
          ))}
          {statusApps.map((app) => (
            <span
              key={app.id}
              title={app.description ?? undefined}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium ${toneClassFor(app.tone)}`}
            >
              {app.label}: {app.value}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shortcutApps.map((app) =>
            app.href ? (
              <Link
                key={app.id}
                href={app.href}
                title={app.description ?? undefined}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium hover:opacity-90 ${toneClassFor(app.tone)}`}
              >
                {app.label}: {app.value}
              </Link>
            ) : (
              <span
                key={app.id}
                title={app.description ?? undefined}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${toneClassFor(app.tone)}`}
              >
                {app.label}: {app.value}
              </span>
            ),
          )}
        </div>
      </div>
    </footer>
  );
}
