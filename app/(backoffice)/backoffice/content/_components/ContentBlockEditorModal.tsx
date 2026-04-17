"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { BlockInspectorFields, type BlockInspectorFieldsCtx } from "./BlockInspectorFields";
import { getBlockShortLabel } from "./blockLabels";
import type { Block } from "./editorBlockTypes";

export type ContentBlockEditorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: Block | null;
  ctx: BlockInspectorFieldsCtx;
};

/**
 * Umbraco-style block list: all property editing happens here (BlockInspectorFields → BlockPropertyEditorRouter).
 * Used from `/backoffice/content/[id]` when the user chooses Rediger on a block row.
 */
export function ContentBlockEditorModal(props: ContentBlockEditorModalProps) {
  const { open, onOpenChange, block, ctx } = props;
  const def = block ? getBlockTypeDefinition(block.type) : null;
  const heading = def?.title ?? block?.type ?? "Blokk";
  const subtitle = block ? getBlockShortLabel(block.type) : "";

  return (
    <Dialog open={open && block != null} onOpenChange={onOpenChange}>
      <DialogContent
        variant="outline"
        showClose
        className="flex max-h-[min(90vh,880px)] w-full max-w-3xl flex-col overflow-hidden !border-slate-200/95 !bg-white shadow-[0_10px_40px_rgba(15,23,42,0.12)]"
        title={<span className="font-heading text-lg font-semibold tracking-tight text-slate-900">{heading}</span>}
        description={
          block ? (
            <span className="text-xs font-normal text-slate-500">
              {subtitle}
              <span className="ml-1.5 font-mono text-[11px] text-slate-400">{block.type}</span>
            </span>
          ) : null
        }
      >
        {block ? (
          <div
            className="min-h-0 max-h-[min(72vh,680px)] flex-1 overflow-y-auto overflow-x-hidden px-0.5 pr-1"
            data-lp-content-block-editor-modal-body="true"
          >
            <BlockInspectorFields block={block} ctx={ctx} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
