"use client";

import { usePathname } from "next/navigation";
import { BlockInspectorFields, type BlockInspectorFieldsCtx } from "./BlockInspectorFields";
import type { Block } from "./editorBlockTypes";
import { BlockTypeIcon } from "./BlockTypeIcon";
import { getBlockLabel } from "./blockLabels";
import { blockTypeSubtitle } from "./contentWorkspace.blocks";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";

/** Egenskaps-panelets blokk-inspector — wiring samlet her, ikke i `ContentWorkspace.tsx`. */
export function ContentWorkspacePropertiesInspectorCard(props: {
  showBlocks: boolean;
  selectedBlockForInspector: Block | null;
  /** 1-based position in block list; null when unknown. */
  selectedBlockOrdinal: number | null;
  ctx: BlockInspectorFieldsCtx;
}) {
  const { showBlocks, selectedBlockForInspector, selectedBlockOrdinal, ctx } = props;
  const pathname = usePathname() ?? "";
  const isContentDetailEditor = resolveBackofficeContentRoute(pathname).kind === "detail";
  if (!showBlocks || !selectedBlockForInspector) return null;
  const subtitle = blockTypeSubtitle(selectedBlockForInspector.type, selectedBlockForInspector);
  return (
    <div
      data-lp-inspector-block-root
      data-lp-inspector-block-id={selectedBlockForInspector.id}
      data-lp-pe-block-kind={selectedBlockForInspector.type}
      className="max-h-[min(50vh,28rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div
        className={`sticky top-0 z-[1] border-b border-slate-200/80 px-3 py-2 ${
          isContentDetailEditor ? "bg-white" : "bg-gradient-to-b from-pink-50/50 to-white"
        }`}
        data-lp-inspector-property-editor-banner
      >
        {!isContentDetailEditor ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-pink-900/55">Egenskapseditor</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-900/70">Valgt blokk</p>
          </>
        ) : null}
        <div className={isContentDetailEditor ? "flex items-center gap-2" : "mt-1 flex items-center gap-2"}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white">
            <BlockTypeIcon type={selectedBlockForInspector.type} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[rgb(var(--lp-text))]">
              {getBlockLabel(selectedBlockForInspector.type)}
            </p>
            {!isContentDetailEditor ? (
              <p className="text-[11px] text-[rgb(var(--lp-muted))]" data-lp-inspector-ordinal-line>
                {selectedBlockOrdinal != null ? `Nr. ${selectedBlockOrdinal} i body · ` : null}
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-2">
        <BlockInspectorFields block={selectedBlockForInspector} ctx={ctx} />
      </div>
    </div>
  );
}
