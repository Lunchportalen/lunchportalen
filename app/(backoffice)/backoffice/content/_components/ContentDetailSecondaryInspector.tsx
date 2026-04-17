"use client";

import { useMemo, useState } from "react";
import { useBellissimaWorkspaceModel } from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import type { ContentBellissimaWorkspaceActionDescriptor } from "@/lib/cms/backofficeWorkspaceContextModel";
import Link from "next/link";
import { DocumentDetailLocaleSection } from "./contentDocumentScalarEditors";
import type { ContentWorkspacePropertiesRailProps } from "./ContentWorkspacePropertiesRail";
import { BlockInspectorFields } from "./BlockInspectorFields";

type RailTabId = "content" | "info" | "actions";

function RailActionRow({ action }: { action: ContentBellissimaWorkspaceActionDescriptor }) {
  const row =
    "flex min-h-9 w-full items-center px-2 py-2 text-left text-[12px] font-medium text-slate-800 transition-colors hover:bg-white/70 hover:text-slate-950";
  if (action.href) {
    return (
      <Link href={action.href} className={row}>
        {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={!action.enabled}
      onClick={() => void action.onSelect?.()}
      className={`${row} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {action.label}
    </button>
  );
}

/** Umbraco-lignende høyre rail: Content / Info / Actions — lesbar, tett, integrert med editoren. */
export function ContentDetailSecondaryInspector(props: ContentWorkspacePropertiesRailProps) {
  const {
    editorLocale,
    setEditorLocale,
    page,
    documentTypeAlias,
    statusLabel,
    effectiveId,
    selectedBlockForInspector,
    blockInspectorCtx,
  } = props;
  const model = useBellissimaWorkspaceModel();
  const [railTab, setRailTab] = useState<RailTabId>("content");

  const secondaryActions = model?.secondaryActions ?? [];
  const entityExtras = useMemo(() => {
    if (!model?.snapshot || model.snapshot.viewScope !== "entity") return [];
    const visible = new Set([
      ...model.primaryActions.map((a) => a.id),
      ...model.secondaryActions.map((a) => a.id),
    ]);
    return model.entityActions.filter((a) => {
      if (a.id === "edit" && model.snapshot.activeWorkspaceView === "content") return false;
      return !visible.has(a.id);
    });
  }, [model]);

  const tabBtn = (id: RailTabId, label: string) => {
    const on = railTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setRailTab(id)}
        className={`min-h-9 flex-1 px-1 py-2 text-center text-[11px] font-semibold uppercase leading-snug tracking-wide text-slate-600 sm:text-xs ${
          on
            ? "bg-white text-[#2a3b96] shadow-[inset_0_-3px_0_0_#2a3b96]"
            : "bg-[#e6e8ed] hover:bg-[#eceef3] hover:text-slate-900"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f1f3f6]"
      data-lp-content-detail-secondary-inspector="true"
      data-lp-detail-secondary-mode="umbraco-rail"
      role="complementary"
      aria-label="Content, Info, Actions"
    >
      <div className="flex shrink-0 border-b border-slate-300/80 bg-[#e6e8ed]">
        {tabBtn("content", "Content")}
        {tabBtn("info", "Info")}
        {tabBtn("actions", "Actions")}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f1f3f6] px-2 py-2">
        {railTab === "content" ? (
          <div className="space-y-2" data-lp-detail-rail-module-column="true">
            <p className="text-[11px] leading-snug text-slate-500">
              Denne kolonnen er kun inspector. Bytt arbeidsflate (rediger / forhåndsvisning / historikk) via
              dokumentets egne kontroller — ikke her.
            </p>
            {selectedBlockForInspector ? (
              <BlockInspectorFields
                block={selectedBlockForInspector}
                ctx={blockInspectorCtx}
                moduleSettingsPresentation
              />
            ) : (
              <p className="rounded-md border border-dashed border-slate-300/80 bg-white/80 px-2.5 py-3 text-[12px] leading-snug text-slate-600">
                Velg en modul i hovedflaten. Egenskaper og innstillinger for valgt modul vises her.
              </p>
            )}
          </div>
        ) : null}

        {railTab === "info" ? (
          <dl className="divide-y divide-slate-300/70 text-[12px] text-slate-800">
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 px-1 py-2">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{statusLabel === "published" ? "Publisert" : "Utkast"}</dd>
            </div>
            {documentTypeAlias ? (
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 px-1 py-2">
                <dt className="text-slate-500">Type</dt>
                <dd className="break-all font-mono text-[11px] leading-snug">{documentTypeAlias}</dd>
              </div>
            ) : null}
            {effectiveId ? (
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 px-1 py-2">
                <dt className="text-slate-500">ID</dt>
                <dd className="break-all font-mono text-[11px] leading-snug text-slate-700">{effectiveId}</dd>
              </div>
            ) : null}
            <div className="px-1 py-2">
              <dt className="mb-1.5 text-[11px] font-medium text-slate-500">Språk / varianter</dt>
              <dd className="min-w-0 text-[12px]">
                <DocumentDetailLocaleSection
                  editorLocale={editorLocale}
                  setEditorLocale={setEditorLocale}
                  page={page}
                />
              </dd>
            </div>
          </dl>
        ) : null}

        {railTab === "actions" ? (
          <div className="divide-y divide-slate-300/70 rounded-md border border-slate-300/50 bg-white/80">
            {secondaryActions.map((action) => (
              <RailActionRow key={action.id} action={action} />
            ))}
            {entityExtras.map((action) => (
              <RailActionRow key={`entity-${action.id}`} action={action} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
