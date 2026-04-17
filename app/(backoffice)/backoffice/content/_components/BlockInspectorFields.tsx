"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import { analyzeBlock } from "@/lib/cms/editorSmartHints";

import type { Block } from "./editorBlockTypes";
import type { BlockInspectorFieldsCtx } from "./blockPropertyEditorContract";

export type { BlockInspectorFieldsCtx } from "./blockPropertyEditorContract";

import { BlockInspectorIdentityCard } from "./BlockInspectorFieldsIdentity";
import {
  BlockInspectorQualitySectionDetailCollapsed,
  BlockInspectorQualitySectionOpen,
} from "./BlockInspectorFieldsQuality";

import { BlockPropertyEditorRouter } from "./blockPropertyEditors/BlockPropertyEditorRouter";
import { InspectorDeferredHintSlotContext } from "./inspectorDeferredHintSlotContext";

/* =========================================================
   COMPONENT
========================================================= */

export function BlockInspectorFields({
  block,
  ctx,
  documentSectionEmbedded,
  /** Dokument-detail: egenskaper i høyre rail som modulinnstillinger (ikke inline under rad). */
  moduleSettingsPresentation = false,
}: {
  block: Block;
  ctx: BlockInspectorFieldsCtx;
  documentSectionEmbedded?: boolean;
  moduleSettingsPresentation?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const isDetail = resolveBackofficeContentRoute(pathname).kind === "detail";

  const [hintHost, setHintHost] = useState<HTMLDivElement | null>(null);

  const isEmbedded = Boolean(documentSectionEmbedded && isDetail && !moduleSettingsPresentation);

  const blockQuality = analyzeBlock(block);

  /* =========================================================
     PROPERTY EDITOR (CORE)
  ========================================================= */

  const propertyEditor = (
    <InspectorDeferredHintSlotContext.Provider value={hintHost}>
      <div
        className={isEmbedded || moduleSettingsPresentation ? "min-w-0 space-y-2" : "space-y-3"}
        data-lp-property-editor-surface
      >
        <BlockPropertyEditorRouter block={block} ctx={ctx} />

        {/* deferred hints (AI / validation / etc) */}
        <div ref={setHintHost} />
      </div>
    </InspectorDeferredHintSlotContext.Provider>
  );

  /* =========================================================
     DETAIL — MODULSETTINGS I HØYRE RAIL
  ========================================================= */

  if (moduleSettingsPresentation && isDetail) {
    return (
      <div
        className="min-w-0 space-y-3 rounded-md border border-slate-300/70 bg-white px-2.5 py-3 shadow-sm"
        data-lp-detail-module-settings-rail
        data-lp-block-type={block.type}
      >
        <div className="space-y-0.5 border-b border-slate-200/80 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Modulinnstillinger</p>
          <BlockInspectorIdentityCard block={block} />
        </div>
        {propertyEditor}
        <BlockInspectorQualitySectionDetailCollapsed blockQuality={blockQuality} tone="default" />
      </div>
    );
  }

  /* =========================================================
     DETAIL MODE (UMBRACO INLINE)
  ========================================================= */

  if (isEmbedded) {
    return (
      <div
        className="min-w-0 space-y-2 border-t border-slate-200/65 bg-transparent pt-3"
        data-lp-detail-inline-editor
        data-lp-block-type={block.type}
      >
        {propertyEditor}

        <BlockInspectorQualitySectionDetailCollapsed
          blockQuality={blockQuality}
          tone="embeddedQuiet"
        />
      </div>
    );
  }

  /* =========================================================
     INSPECTOR MODE (SIDEPANEL)
  ========================================================= */

  return (
    <div
      className="space-y-4"
      data-lp-inspector
      data-lp-block-type={block.type}
    >
      {!isDetail && <BlockInspectorIdentityCard block={block} />}

      {!isDetail && (
        <BlockInspectorQualitySectionOpen blockQuality={blockQuality} />
      )}

      {propertyEditor}

      {isDetail && (
        <BlockInspectorQualitySectionDetailCollapsed
          blockQuality={blockQuality}
          tone="default"
        />
      )}
    </div>
  );
}