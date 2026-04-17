import type { ReactNode } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { WorkspaceContextChrome } from "@/components/backoffice/WorkspaceContextChrome";
import type { WorkspaceStatusChip } from "@/lib/cms/backofficeWorkspaceContextModel";

export type BackofficeWorkspaceSurfaceProps = {
  /** Én H1 per visning (Umbraco-lignende workspace). */
  title: string;
  /** Kort redaktør-kontekst under tittel. */
  lead?: ReactNode;
  /** Stabil id for tester / konsistens (f.eks. `domains`, `seo-growth`). */
  workspaceId: string;
  children: ReactNode;
  /**
   * U21 — Ett avsnitt som svarer på «hva slags objekt / sannhet er dette?» (CMS vs runtime).
   */
  contextSummary?: ReactNode;
  /** U21 — Korte signals (draft, runtime, posture). */
  statusChips?: readonly WorkspaceStatusChip[];
  /** Primære workspace actions (Umbraco workspace actions — lenker/knapper). */
  toolbar?: ReactNode;
  /** U21 — Sekundære handlinger (review, ekstra runtime-lenker). */
  secondaryActions?: ReactNode;
  /**
   * Ærlig merknad om publish/history — ingen falsk samlet logg.
   * Brukes der to spor (Postgres vs Sanity) bør forklares i krom.
   */
  publishHistoryNote?: ReactNode;
  /**
   * U21 — Footer apps-lignende vedvarende status/handlinger under hovedinnhold (read-only der så angitt).
   */
  footerApps?: ReactNode;
  /** `default` = PageContainer 1440px; `fullBleed` = full høyde under TopBar (growth-klienter). */
  layout?: "default" | "fullBleed";
};

/**
 * CP11 — Felles workspace-krom for backoffice uten ny shell ved siden av BackofficeShell.
 * U21 — Kontekst-chips, sekundære handlinger og footer apps (Umbraco-lignende workspace-paritet).
 */
export function BackofficeWorkspaceSurface({
  title,
  lead,
  workspaceId,
  children,
  contextSummary,
  statusChips,
  toolbar,
  secondaryActions,
  publishHistoryNote,
  footerApps,
  layout = "default",
}: BackofficeWorkspaceSurfaceProps) {
  const headerInner = (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {lead ? <div className="mt-2 max-w-3xl text-sm text-slate-600">{lead}</div> : null}
      <WorkspaceContextChrome contextSummary={contextSummary} statusChips={statusChips} />
      {toolbar ? (
        <div className="mt-4 flex flex-wrap gap-2" role="toolbar" aria-label="Primære handlinger">
          {toolbar}
        </div>
      ) : null}
      {secondaryActions ? (
        <div className="mt-3 flex flex-wrap gap-2" role="toolbar" aria-label="Sekundære handlinger">
          {secondaryActions}
        </div>
      ) : null}
      {publishHistoryNote ? (
        <aside className="mt-4 max-w-3xl rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs leading-relaxed text-slate-800">
          {publishHistoryNote}
        </aside>
      ) : null}
    </>
  );

  const footerBlock =
    footerApps != null ? (
      <footer
        className="border-t border-slate-200/90 bg-slate-50/95 px-4 py-3 text-[11px] leading-relaxed text-slate-700 sm:px-6"
        role="region"
        aria-label="Workspace status og hurtighandlinger"
      >
        <div className="mx-auto max-w-[1440px]">{footerApps}</div>
      </footer>
    ) : null;

  if (layout === "fullBleed") {
    return (
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden bg-[rgb(var(--lp-bg))]"
        data-workspace={workspaceId}
      >
        <header className="shrink-0 border-b border-slate-200/90 bg-white/95 px-4 py-5 shadow-sm sm:px-6">
          <div className="mx-auto max-w-[1440px]">{headerInner}</div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          {footerBlock}
        </div>
      </div>
    );
  }

  return (
    <div data-workspace={workspaceId}>
      <PageContainer className="max-w-[1440px] py-8">
        <header className="border-b border-slate-200/80 pb-6">{headerInner}</header>
        <div className="mt-8">{children}</div>
        {footerApps != null ? (
          <footer
            className="mt-10 border-t border-slate-200/90 pt-4 text-[11px] leading-relaxed text-slate-700"
            role="region"
            aria-label="Workspace status og hurtighandlinger"
          >
            {footerApps}
          </footer>
        ) : null}
      </PageContainer>
    </div>
  );
}

/** Samme H1/lead-mønster for klient-sider (f.eks. media) uten full surface-layout. */
export function BackofficeWorkspaceHeader({
  title,
  lead,
  workspaceId,
  contextSummary,
  statusChips,
  toolbar,
  secondaryActions,
}: Pick<
  BackofficeWorkspaceSurfaceProps,
  | "title"
  | "lead"
  | "workspaceId"
  | "contextSummary"
  | "statusChips"
  | "toolbar"
  | "secondaryActions"
>) {
  return (
    <header
      data-workspace={workspaceId}
      className="flex flex-col gap-2 border-b border-slate-200/80 pb-4"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {lead ? <div className="mt-2 max-w-3xl text-sm text-slate-600">{lead}</div> : null}
        </div>
        {toolbar ? (
          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end" role="toolbar" aria-label="Primære handlinger">
            {toolbar}
          </div>
        ) : null}
      </div>
      <WorkspaceContextChrome contextSummary={contextSummary} statusChips={statusChips} />
      {secondaryActions ? (
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Sekundære handlinger">
          {secondaryActions}
        </div>
      ) : null}
    </header>
  );
}
