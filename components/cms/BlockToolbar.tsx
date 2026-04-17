"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Copy, PencilLine, Trash2 } from "lucide-react";
import { DsToolbar } from "@/components/ui/ds";
import { motion } from "@/lib/design/tokens";
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const TOOL_BTN =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-[rgb(var(--lp-text))] " +
  `${motion.transitionFast} hover:bg-slate-100/95 hover:text-[rgb(var(--lp-text))] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35`;

const TOOL_DANGER =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-red-700 " +
  `${motion.transitionFast} hover:bg-red-50 active:scale-[0.97]`;

/** Detail content list: smaller, quieter controls; edit is the primary control. */
const ENTRY_SECONDARY =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-transparent text-slate-400 opacity-45 " +
  `${motion.transitionFast} group-hover/block-card:opacity-80 hover:bg-slate-100/70 hover:text-slate-600 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-25`;

const ENTRY_EDIT_LABELLED =
  "inline-flex h-7 min-h-[28px] min-w-[4.25rem] shrink-0 items-center justify-center gap-1 rounded border border-slate-200/70 bg-white px-2.5 text-xs font-medium text-slate-800 " +
  `${motion.transitionFast} hover:border-slate-300/80 hover:bg-white hover:shadow-[0_1px_2px_rgba(15,23,42,0.05)] active:scale-[0.98]`;

const ENTRY_DANGER =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-transparent text-slate-400 opacity-40 " +
  `${motion.transitionFast} group-hover/block-card:opacity-75 hover:bg-red-50/90 hover:text-red-700/95 active:scale-[0.97]`;

/** Detail feltliste: redaksjonsverktøy, ikke CTA — lett å finne, lite «knapp». */
const FIELD_EDIT =
  "inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-sm border-0 bg-transparent px-1.5 text-xs font-medium text-slate-600 " +
  `${motion.transitionFast} hover:bg-slate-100/55 hover:text-slate-900 ` +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300/40 active:scale-[0.99]";

/** Ikoner inni hover-klynge — full opasitet når foreldre vises. */
const FIELD_CLUSTER_ICON =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-0 bg-transparent text-slate-400 " +
  `${motion.transitionFast} hover:bg-slate-100/80 hover:text-slate-600 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-25`;

const FIELD_CLUSTER_DANGER =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-0 bg-transparent text-slate-400 " +
  `${motion.transitionFast} hover:bg-red-50/90 hover:text-red-700/90 active:scale-[0.97]`;

export type BlockToolbarProps = {
  ariaLabel: string;
  disabledMoveUp: boolean;
  disabledMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  /** When false, toolbar stays visible on md (e.g. selected block). */
  revealOnGroupHover?: boolean;
  /** `inline` = docked in block chrome row; `overlay` = floating cluster (legacy). */
  attach?: "overlay" | "inline";
  /**
   * `/backoffice/content/[id]` block list: grouped, subdued chrome — edit first, reorder/duplicate quieter.
   */
  editorEntryChrome?: boolean;
  /**
   * Detail document feltliste: flat liste, ikke canvas-rad — rediger lett synlig; reorder/dup/slett mer skjult
   * til `group/detail-field-entry` hover eller fokus innenfor raden.
   */
  fieldListMode?: boolean;
  /** @deprecated — sekundærknapper styres av hover-klynge; beholdes for API-kompatibilitet. */
  fieldListSelected?: boolean;
  /** Innhold rett etter slett (f.eks. drahåndtak) — samme hover-klynge som reorder. */
  fieldListTrailing?: React.ReactNode;
  /** Dokumentseksjon: samme ikonrad som reorder — ingen «Rediger»-tekstknapp. */
  fieldListToolsIconOnly?: boolean;
  /** Extra classes on the toolbar shell (e.g. detail list grouping). */
  toolbarClassName?: string;
};

function BlockToolbarInner({
  ariaLabel,
  disabledMoveUp,
  disabledMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onEdit,
  onDelete,
  revealOnGroupHover = true,
  attach = "overlay",
  editorEntryChrome = false,
  fieldListMode = false,
  fieldListSelected: _fieldListSelected = false,
  fieldListTrailing = null,
  fieldListToolsIconOnly = false,
  toolbarClassName,
}: BlockToolbarProps) {
  const fieldList = Boolean(fieldListMode && editorEntryChrome);
  const fieldIconOnly = Boolean(fieldList && fieldListToolsIconOnly);
  const shellCls = editorEntryChrome
    ? cn(
        fieldListMode
          ? "gap-0.5 border-0 bg-transparent px-0 py-0 shadow-none"
          : "gap-0.5 rounded-md border-0 bg-transparent px-0 py-0 shadow-none",
        toolbarClassName,
      )
    : toolbarClassName;

  const reorderUp = (
    <button
      type="button"
      disabled={disabledMoveUp}
      onClick={onMoveUp}
      className={cn(
        fieldList ? FIELD_CLUSTER_ICON : editorEntryChrome ? ENTRY_SECONDARY : TOOL_BTN,
      )}
      title="Flytt opp"
      aria-label="Flytt blokk opp"
    >
      <ChevronUp className={editorEntryChrome || fieldList ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
    </button>
  );
  const reorderDown = (
    <button
      type="button"
      disabled={disabledMoveDown}
      onClick={onMoveDown}
      className={cn(
        fieldList ? FIELD_CLUSTER_ICON : editorEntryChrome ? ENTRY_SECONDARY : TOOL_BTN,
      )}
      title="Flytt ned"
      aria-label="Flytt blokk ned"
    >
      <ChevronDown className={editorEntryChrome || fieldList ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
    </button>
  );
  const duplicateBtn = (
    <button
      type="button"
      onClick={onDuplicate}
      className={cn(
        fieldList ? FIELD_CLUSTER_ICON : editorEntryChrome ? ENTRY_SECONDARY : TOOL_BTN,
      )}
      title="Dupliser blokk"
      aria-label="Dupliser blokk"
    >
      <Copy className={editorEntryChrome || fieldList ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
    </button>
  );
  const editBtn =
    onEdit != null ? (
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          fieldIconOnly
            ? FIELD_CLUSTER_ICON
            : fieldList
              ? FIELD_EDIT
              : editorEntryChrome
                ? ENTRY_EDIT_LABELLED
                : TOOL_BTN,
        )}
        title={fieldIconOnly ? "Rediger seksjon" : "Rediger (modal)"}
        aria-label={fieldIconOnly ? "Rediger seksjon" : "Rediger blokk i modal"}
      >
        {editorEntryChrome && !fieldList ? (
          <>
            <PencilLine className="h-3 w-3 shrink-0" aria-hidden />
            <span className="text-xs font-medium tracking-tight">Rediger</span>
          </>
        ) : fieldList && !fieldIconOnly ? (
          <>
            <PencilLine className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            <span className="tracking-tight">Rediger</span>
          </>
        ) : (
          <PencilLine className={fieldIconOnly ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        )}
      </button>
    ) : null;
  const deleteBtn = (
    <button
      type="button"
      onClick={onDelete}
      className={cn(
        fieldList ? FIELD_CLUSTER_DANGER : editorEntryChrome ? ENTRY_DANGER : TOOL_DANGER,
      )}
      title="Slett blokk"
      aria-label="Slett blokk"
    >
      <Trash2 className={editorEntryChrome || fieldList ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
    </button>
  );

  const defaultOrder = (
    <>
      {reorderUp}
      {reorderDown}
      {duplicateBtn}
      {editBtn}
      {deleteBtn}
    </>
  );

  const fieldListSubordinateWrap = (inner: React.ReactNode) => (
    <span
      className={cn(
        "inline-flex items-center gap-px",
        "opacity-100 md:opacity-0 md:transition-opacity md:duration-150",
        "md:group-hover/detail-field-entry:opacity-100 md:group-focus-within/detail-field-entry:opacity-100",
      )}
    >
      {inner}
    </span>
  );

  const entryOrder =
    onEdit != null ? (
      fieldIconOnly ? (
        fieldListSubordinateWrap(
          <>
            {reorderUp}
            {reorderDown}
            {duplicateBtn}
            {editBtn}
            {deleteBtn}
            {fieldListTrailing}
          </>,
        )
      ) : (
        <>
          {editBtn}
          {fieldList
            ? fieldListSubordinateWrap(
                <>
                  <span
                    className="mx-0.5 hidden h-3.5 w-px shrink-0 bg-slate-200/30 sm:inline-block"
                    aria-hidden
                  />
                  {reorderUp}
                  {reorderDown}
                  {duplicateBtn}
                  {deleteBtn}
                  {fieldListTrailing}
                </>,
              )
            : (
                <>
                  <span
                    className="mx-0.5 hidden h-3.5 w-px shrink-0 bg-slate-200/35 sm:inline-block"
                    aria-hidden
                  />
                  {reorderUp}
                  {reorderDown}
                  {duplicateBtn}
                  {deleteBtn}
                </>
              )}
        </>
      )
    ) : (
      defaultOrder
    );

  return (
    <DsToolbar
      aria-label={ariaLabel}
      data-lp-block-actions
      data-lp-block-actions-editor-entry={editorEntryChrome ? "true" : undefined}
      data-lp-block-actions-field-list={fieldList ? "true" : undefined}
      revealOnGroupHover={fieldList ? false : revealOnGroupHover}
      attach={attach}
      className={shellCls}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
    >
      {editorEntryChrome && onEdit != null ? entryOrder : defaultOrder}
    </DsToolbar>
  );
}

export const BlockToolbar = React.memo(BlockToolbarInner);
BlockToolbarInner.displayName = "BlockToolbar";
