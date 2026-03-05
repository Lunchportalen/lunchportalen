"use client";

import React, { useCallback, useState } from "react";

export type BlockCanvasBlock = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

type BlockCanvasProps = {
  blocks: BlockCanvasBlock[];
  activeBlockId: string | null;
  onSelect: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onAddAt?: (index: number) => void;
  getBlockLabel: (type: string) => string;
  getBlockSummary?: (block: BlockCanvasBlock) => string;
  renderBlockPreview?: (block: BlockCanvasBlock) => React.ReactNode;
};

function stripHtml(html: string): string {
  if (typeof html !== "string") return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(s: string, max: number): string {
  const t = String(s ?? "").trim();
  return t.length <= max ? t : t.slice(0, max) + "…";
}

/** Safe small preview for canvas card: no scripts, text/snippet only */
function defaultPreview(block: BlockCanvasBlock, getBlockLabel: (t: string) => string, getBlockSummary?: (b: BlockCanvasBlock) => string): React.ReactNode {
  const label = getBlockLabel(block.type);
  const summary = getBlockSummary ? getBlockSummary(block) : "";
  const data = block.data ?? {};
  let snippet = summary;
  if (block.type === "code" || block.type === "richText") {
    const raw = block.type === "code" ? String(data.code ?? "") : String(data.body ?? data.heading ?? "");
    snippet = truncate(stripHtml(raw), 120) || summary;
  }
  return (
    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500" title={snippet}>
      {snippet || label}
    </p>
  );
}

export function BlockCanvas({
  blocks,
  activeBlockId,
  onSelect,
  onMove,
  onRemove,
  onAddAt,
  getBlockLabel,
  getBlockSummary,
  renderBlockPreview,
}: BlockCanvasProps) {
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
      setDragFromIndex(index);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragFromIndex === null) return;
      if (index === dragFromIndex) {
        setDropTargetIndex(null);
        setDropPosition(null);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const before = e.clientY < mid;
      setDropTargetIndex(index);
      setDropPosition(before ? "before" : "after");
    },
    [dragFromIndex]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTargetIndex(null);
      setDropPosition(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const fromStr = e.dataTransfer.getData("text/plain");
      const fromIndex = fromStr !== "" ? parseInt(fromStr, 10) : null;
      if (fromIndex == null || dropTargetIndex == null || dropPosition == null) {
        setDragFromIndex(null);
        setDropTargetIndex(null);
        setDropPosition(null);
        return;
      }
      const toIndex = dropPosition === "before" ? dropTargetIndex : dropTargetIndex + 1;
      if (fromIndex !== toIndex) {
        onMove(fromIndex, toIndex);
      }
      setDragFromIndex(null);
      setDropTargetIndex(null);
      setDropPosition(null);
    },
    [dropTargetIndex, dropPosition, onMove]
  );

  const handleDragEnd = useCallback(() => {
    setDragFromIndex(null);
    setDropTargetIndex(null);
    setDropPosition(null);
  }, []);

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onRemove(id);
    },
    [onRemove]
  );

  const previewFor = useCallback(
    (block: BlockCanvasBlock): React.ReactNode => {
      if (renderBlockPreview) return renderBlockPreview(block);
      return defaultPreview(block, getBlockLabel, getBlockSummary);
    },
    [getBlockLabel, getBlockSummary, renderBlockPreview]
  );

  const typeIcon =
    (type: string) =>
    (type === "hero"
      ? "H"
      : type === "richText"
        ? "T"
        : type === "image"
          ? "I"
          : type === "cta"
            ? "C"
            : type === "banners"
              ? "B"
              : type === "code"
                ? "<>"
                : type === "windows"
                  ? "W"
                  : "•");

  if (blocks.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
        <p className="font-medium text-slate-600">Ingen blokker</p>
        <p className="mt-1">Legg til innhold i listen til venstre.</p>
        {onAddAt && (
          <button
            type="button"
            onClick={() => onAddAt(0)}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            + Legg til blokk
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {blocks.map((block, index) => {
        const isActive = block.id === activeBlockId;
        const isDragging = dragFromIndex === index;
        const showDropBefore = dropTargetIndex === index && dropPosition === "before";
        const showDropAfter = dropTargetIndex === index && dropPosition === "after";

        return (
          <React.Fragment key={block.id}>
            {showDropBefore && (
              <div
                className="h-0.5 flex-shrink-0 rounded-full bg-slate-900"
                aria-hidden
                data-drop-indicator
              />
            )}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={`group relative rounded-lg border bg-white transition ${
                isDragging ? "opacity-50" : ""
              } ${isActive ? "ring-2 ring-slate-900 ring-offset-1" : "border-slate-200 hover:border-slate-300"}`}
              data-block-id={block.id}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={`Blokk: ${getBlockLabel(block.type)}`}
                aria-selected={isActive}
                onClick={() => onSelect(block.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(block.id);
                  }
                }}
                className="flex cursor-pointer flex-col p-3 text-left outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 rounded-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] text-slate-500 active:cursor-grabbing"
                      title="Dra for å endre rekkefølge"
                      aria-hidden
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      ⠿
                    </span>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                      {typeIcon(block.type)}
                    </span>
                    <span className="truncate text-xs font-semibold text-slate-900">
                      {getBlockLabel(block.type)}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">#{index + 1}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {index > 0 && (
                      <button
                        type="button"
                        className="rounded p-1 text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        title="Flytt opp"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove(index, index - 1);
                        }}
                      >
                        ↑
                      </button>
                    )}
                    {index < blocks.length - 1 && (
                      <button
                        type="button"
                        className="rounded p-1 text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        title="Flytt ned"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove(index, index + 1);
                        }}
                      >
                        ↓
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded p-1 text-[10px] text-red-600 hover:bg-red-50"
                      title="Fjern blokk"
                      onClick={(e) => handleRemoveClick(e, block.id)}
                    >
                      Fjern
                    </button>
                  </div>
                </div>
                <div className="mt-1 min-h-[20px] rounded border border-slate-100 bg-slate-50/50 px-2 py-1.5">
                  {previewFor(block)}
                </div>
              </div>
            </div>
            {showDropAfter && (
              <div
                className="h-0.5 flex-shrink-0 rounded-full bg-slate-900"
                aria-hidden
                data-drop-indicator
              />
            )}
          </React.Fragment>
        );
      })}
      {onAddAt && (
        <button
          type="button"
          onClick={() => onAddAt(blocks.length)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-2 text-[11px] text-slate-500 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          + Legg til blokk
        </button>
      )}
    </div>
  );
}
