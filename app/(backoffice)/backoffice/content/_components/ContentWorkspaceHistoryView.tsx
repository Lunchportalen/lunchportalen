"use client";

import Link from "next/link";
import {
  contentGovernedPostureLabel,
  workspaceHistoryStatusLabel,
  workspaceHistoryStatusTone,
  type ContentGovernedPosture,
  type WorkspaceHistoryStatus,
} from "@/lib/cms/backofficeWorkspaceContextModel";
import { ContentPageVersionHistory, type HistoryPreviewPayload, type RestoredPagePayload } from "./ContentPageVersionHistory";
import { ContentWorkspaceAuditTimeline } from "./ContentWorkspaceAuditTimeline";

export function ContentWorkspaceHistoryView({
  pageId,
  locale,
  environment,
  pageUpdatedAt,
  historyStatus,
  documentTypeAlias,
  governedPosture,
  publishState,
  previewHref,
  onApplyHistoryPreview,
  onApplyRestoredPage,
}: {
  pageId: string;
  locale: string;
  environment: string;
  pageUpdatedAt: string | null;
  historyStatus: WorkspaceHistoryStatus;
  documentTypeAlias: string | null;
  governedPosture: ContentGovernedPosture;
  publishState: "draft" | "published";
  previewHref: string | null;
  onApplyHistoryPreview: (payload: HistoryPreviewPayload) => void;
  onApplyRestoredPage: (page: RestoredPagePayload) => void;
}) {
  const historyToneClass =
    workspaceHistoryStatusTone(historyStatus) === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : workspaceHistoryStatusTone(historyStatus) === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <article className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Historikkstatus</p>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${historyToneClass}`}>
              {workspaceHistoryStatusLabel(historyStatus)}
            </span>
          </div>
          <p className="mt-3 text-lg font-semibold text-[rgb(var(--lp-text))]">
            {publishState === "published" ? "Publisert side" : "Kladd-side"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--lp-muted))]">
            Audit, versjoner og preview leses som én samlet arbeidsflate. Degradert status skjules ikke.
          </p>
        </article>
        <article className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Governance</p>
          <p className="mt-3 text-lg font-semibold text-[rgb(var(--lp-text))]">{contentGovernedPostureLabel(governedPosture)}</p>
          <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--lp-muted))]">
            {documentTypeAlias ? `Document type: ${documentTypeAlias}` : "Ingen dokumenttype i envelope."}
          </p>
          <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
            Historikkflaten beskriver gjeldende posture uten å late som legacy-innhold er fullt governert.
          </p>
        </article>
        <article className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Verktøy</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ContentPageVersionHistory
              pageId={pageId}
              locale={locale}
              environment={environment}
              pageUpdatedAt={pageUpdatedAt}
              disabled={!pageId.trim()}
              onApplyHistoryPreview={onApplyHistoryPreview}
              onApplyRestoredPage={onApplyRestoredPage}
            />
            {previewHref ? (
              <Link
                href={previewHref}
                className="inline-flex min-h-11 items-center rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
              >
                Åpne preview
              </Link>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--lp-muted))]">
            Versjoner og preview bruker de eksisterende sikre rutene, ikke en ny historikkmotor.
          </p>
        </article>
      </section>

      <ContentWorkspaceAuditTimeline pageId={pageId} historyStatus={historyStatus} />
    </div>
  );
}
