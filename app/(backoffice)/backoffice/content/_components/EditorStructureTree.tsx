"use client";

import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { Block } from "./editorBlockTypes";
import { getBlockTreeLabel } from "./blockLabels";

export type EditorStructureTreeProps = {
  /** Active page/node id (UUID) used to reset per-page UI focus state. */
  nodeId: string | null;
  /** Currently selected block id (single source of truth for active block highlight). */
  selectedBlockId: string | null;
  /** Select a block (drives editor highlight + scroll). */
  onSelectBlock: Dispatch<SetStateAction<string | null>>;
  /** Current page title for the tree root label. */
  pageTitle: string;
  /** Block order for structure labels (may be canvas projection; selection still targets canonical ids). */
  blocks: Block[];
  /** Currently hovered block id (visual only). */
  hoverBlockId: string | null;
  /** Hover callback (visual only). */
  onHoverBlock: (blockId: string | null) => void;
};

type Node =
  | {
      kind: "page_root";
      id: string;
      label: string;
      isSelected: boolean;
      children: Node[];
    }
  | {
      kind: "editor_section";
      id: string;
      label: string;
      isSelected: boolean;
      isExpanded: boolean;
      children: Node[];
    }
  | {
      kind: "block";
      id: string;
      blockId: string;
      label: string;
      isSelected: boolean;
      isExpanded: boolean;
      hasChildren: boolean;
      onToggle: () => void;
      onSelect: () => void;
    };

export function EditorStructureTree({
  nodeId,
  selectedBlockId,
  onSelectBlock,
  pageTitle,
  blocks,
  hoverBlockId,
  onHoverBlock,
}: EditorStructureTreeProps) {
  const sectionsExpanded = true;

  const pendingFocusBlockIdRef = useRef<string | null>(null);

  useEffect(() => {
    pendingFocusBlockIdRef.current = null;
  }, [nodeId]);

  useEffect(() => {
    if (!pendingFocusBlockIdRef.current) return;
    if (!selectedBlockId) return;
    if (pendingFocusBlockIdRef.current !== selectedBlockId) return;

    const targetId = pendingFocusBlockIdRef.current;
    pendingFocusBlockIdRef.current = null;
    const el = document.getElementById(`lp-editor-block-${targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [selectedBlockId]);

  const nodes = useMemo((): Extract<Node, { kind: "page_root" }> => {
    const rootId = `page_root:${pageTitle}`;
    const mainSectionId = "editor_section:main_content";

    const mainChildren: Node[] = blocks.map((block, index) => {
      const isExpanded = selectedBlockId === block.id;
      const isSelected = selectedBlockId === block.id;

      return {
        kind: "block",
        id: `block:${block.id}`,
        blockId: block.id,
        label: `${index + 1}. ${getBlockTreeLabel(block)}`,
        isSelected,
        isExpanded,
        hasChildren: false,
        onToggle: () => {
          onSelectBlock((prev) => (prev === block.id ? null : block.id));
        },
        onSelect: () => {
          onSelectBlock(block.id);
        },
      } as const;
    });

    return {
      kind: "page_root",
      id: rootId,
      label: pageTitle || "Side",
      isSelected: true,
      children: [
        {
          kind: "editor_section",
          id: mainSectionId,
          label: "Hovedinnhold",
          isSelected: true,
          isExpanded: sectionsExpanded,
          children: mainChildren,
        },
      ],
    } as const;
  }, [blocks, onSelectBlock, selectedBlockId, pageTitle, sectionsExpanded]);

  return (
    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Editorstruktur</p>
          <p className="mt-1 truncate text-xs text-slate-600" title={pageTitle || undefined}>
            {pageTitle || "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {nodes.children.map((section) => {
          if (section.kind !== "editor_section") return null;
          return (
            <div key={section.id} className="space-y-1">
              <div
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${
                  section.isExpanded
                    ? "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50"
                    : "border-[rgb(var(--lp-border))] bg-white hover:bg-[rgb(var(--lp-card))]/40"
                }`}
                aria-expanded={section.isExpanded}
              >
                <span
                  className={`h-2 w-2 rounded-full ${section.isExpanded ? "bg-rose-500" : "bg-slate-300"}`}
                  aria-hidden
                />
                <span className="font-semibold text-[rgb(var(--lp-text))]">{section.label}</span>
                <span className="ml-auto text-[11px] text-slate-400" aria-hidden>
                  {blocks.length}
                </span>
              </div>

              {section.isExpanded ? (
                <div className="space-y-1 pl-1">
                  {section.children.map((n) => {
                    if (n.kind !== "block") return null;
                    return (
                      <div
                        key={n.id}
                        className="space-y-1"
                        onMouseEnter={() => onHoverBlock(n.blockId)}
                        onMouseLeave={() => onHoverBlock(null)}
                      >
                        <div
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                            n.isSelected
                              ? "border-rose-200 bg-rose-50/60 ring-1 ring-rose-100"
                              : hoverBlockId === n.blockId && !n.isSelected
                                ? "border-rose-100 bg-white ring-1 ring-rose-100"
                                : "border-[rgb(var(--lp-border))] bg-white hover:bg-[rgb(var(--lp-card))]/40"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={n.onToggle}
                            disabled={false}
                            className={`min-h-[24px] min-w-[24px] flex items-center justify-center rounded-md text-sm disabled:opacity-40 ${
                              n.isSelected ? "text-rose-700 hover:text-rose-800" : "text-slate-500 hover:text-slate-700"
                            }`}
                            aria-label={n.isExpanded ? "Kollapsere blokk" : "Utvid blokk"}
                            title={n.isExpanded ? "Kollapsere" : "Utvid"}
                            aria-expanded={n.isExpanded}
                          >
                            {n.isExpanded ? "▾" : "▸"}
                          </button>

                          <button
                            type="button"
                            onClick={n.onSelect}
                            className={`min-w-0 flex-1 text-left text-xs ${
                              n.isSelected ? "font-semibold text-[rgb(var(--lp-text))]" : "font-medium text-slate-800"
                            }`}
                            aria-current={n.isSelected ? "true" : undefined}
                            title={n.label}
                          >
                            {n.label}
                          </button>

                          {n.isSelected ? (
                            <span
                              className="ml-1 shrink-0 rounded border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-medium text-rose-700"
                              aria-label="Aktiv blokk"
                            >
                              Aktiv
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
