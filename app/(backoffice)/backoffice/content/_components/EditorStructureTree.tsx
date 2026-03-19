"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Block, BannersBlock, BannerItem } from "./editorBlockTypes";
import { getBlockTreeLabel } from "./blockLabels";

export type EditorStructureTreeProps = {
  /** Current page title for the tree root label. */
  pageTitle: string;
  /** Current editor blocks in order (source of truth). */
  blocks: Block[];
  /** Which block is expanded/active in the editor. */
  expandedBlockId: string | null;
  /** Toggle expand/collapse in the editor (maps to BlockInspectorShell). */
  onToggleBlock: (blockId: string) => void;
  /** Selected banner item (only relevant when a banners block is expanded). */
  selectedBannerItemId: string | null;
  /** Select/deselect banner item (maps to BlockInspectorShell). */
  setSelectedBannerItemId: (id: string | null) => void;
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
      label: string;
      isSelected: boolean;
      isExpanded: boolean;
      hasChildren: boolean;
      onToggle: () => void;
      onSelect: () => void;
      children?: Node[];
    }
  | {
      kind: "banner_item";
      id: string;
      label: string;
      isSelected: boolean;
      onSelect: () => void;
    };

function bannerItemLabel(item: BannerItem): string {
  // Prefer explicit name/heading; fall back to a short text snippet.
  const name = (item.name ?? "").trim();
  if (name) return name;
  const heading = (item.heading ?? "").trim();
  if (heading) return heading;
  const secondary = (item.secondaryHeading ?? "").trim();
  if (secondary) return secondary;
  const txt = (item.text ?? "").trim();
  if (txt) return txt.length > 28 ? txt.slice(0, 28).trim() + "…" : txt;
  return "Banner";
}

export function EditorStructureTree({
  pageTitle,
  blocks,
  expandedBlockId,
  onToggleBlock,
  selectedBannerItemId,
  setSelectedBannerItemId,
}: EditorStructureTreeProps) {
  // When rendered, the editor is already in blocks mode (`ContentMainShell` only mounts this tree then),
  // so treat the major section as always expanded to avoid unsynced local UI state.
  const sectionsExpanded = true;

  const pendingFocusBlockIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Deterministic focus: when the editor reports that a block is expanded,
    // scroll the corresponding editor block container into view.
    if (!pendingFocusBlockIdRef.current) return;
    if (!expandedBlockId) return;
    if (pendingFocusBlockIdRef.current !== expandedBlockId) return;

    const targetId = pendingFocusBlockIdRef.current;
    pendingFocusBlockIdRef.current = null;
    const el = document.getElementById(`lp-editor-block-${targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [expandedBlockId]);

  const nodes = useMemo((): Extract<Node, { kind: "page_root" }> => {
    const rootId = `page_root:${pageTitle}`;

    const mainSectionId = "editor_section:main_content";

    const mainChildren: Node[] = blocks.map((block, index) => {
      const isExpanded = expandedBlockId === block.id;
      const isSelected = isExpanded;

      const hasBannersChildren =
        block.type === "banners" && Array.isArray((block as BannersBlock).items);

      const bannerChildren: Node[] | undefined =
        block.type === "banners" && isExpanded
          ? (block as BannersBlock).items.map((item: BannerItem, itemIndex: number) => {
              const selected = selectedBannerItemId === item.id;
              return {
                kind: "banner_item",
                id: `banner_item:${block.id}:${item.id ?? itemIndex}`,
                label: `#${itemIndex + 1} · ${bannerItemLabel(item)}`,
                isSelected: selected,
                onSelect: () => {
                  setSelectedBannerItemId(selected ? null : item.id);
                },
              } as const;
            })
          : undefined;

      return {
        kind: "block",
        id: `block:${block.id}`,
        label: `${index + 1}. ${getBlockTreeLabel(block)}`,
        isSelected,
        isExpanded,
        hasChildren: hasBannersChildren,
        onToggle: () => {
          // Only trigger scroll/focus when the click *opens* the block.
          if (!isExpanded) {
            pendingFocusBlockIdRef.current = block.id;
          }
          onToggleBlock(block.id);
        },
        onSelect: () => {
          if (!isExpanded) {
            pendingFocusBlockIdRef.current = block.id;
            onToggleBlock(block.id);
            return;
          }
          // Already expanded: still scroll to reinforce focus.
          pendingFocusBlockIdRef.current = block.id;
        },
        children: bannerChildren,
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
  }, [
    blocks,
    expandedBlockId,
    onToggleBlock,
    pageTitle,
    sectionsExpanded,
    selectedBannerItemId,
    setSelectedBannerItemId,
  ]);

  return (
    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Editorstruktur
          </p>
          <p
            className="mt-1 truncate text-xs text-slate-600"
            title={pageTitle || undefined}
          >
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
                      <div key={n.id} className="space-y-1">
                        <div
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                            n.isSelected
                              ? "border-rose-200 bg-rose-50/60 ring-1 ring-rose-100"
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
                            aria-label={
                              n.isExpanded ? "Kollapsere blokk" : "Utvid blokk"
                            }
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

                        {n.isExpanded && n.children && n.children.length > 0 ? (
                          <div className="space-y-1 pl-4">
                            {n.children.map((child) => {
                              if (child.kind !== "banner_item") return null;
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={child.onSelect}
                                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${
                                    child.isSelected
                                      ? "border-rose-200 bg-rose-50/60 ring-1 ring-rose-100"
                                      : "border-[rgb(var(--lp-border))] bg-white hover:bg-[rgb(var(--lp-card))]/40"
                                  }`}
                                  aria-current={child.isSelected ? "true" : undefined}
                                  title={child.label}
                                >
                                  <span className="text-slate-400" aria-hidden>
                                    ↳
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {child.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
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

