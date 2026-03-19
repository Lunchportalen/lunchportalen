"use client";

import React, { useCallback, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { getBlockLabel } from "./blockLabels";

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

/** Honest media state for hero/image: no misleading "saved" when media is missing. */
function mediaSnippet(type: string, data: Record<string, unknown>): string | null {
  if (type === "hero") {
    const imageUrl = String(data.imageUrl ?? "").trim();
    const mediaItemId = data.mediaItemId;
    if (mediaItemId && !imageUrl) return "Bilde mangler (mediearkiv)";
    if (!imageUrl) return "Ingen bilde valgt";
    return null;
  }
  if (type === "image") {
    const assetPath = String(data.assetPath ?? "").trim();
    const mediaItemId = data.mediaItemId;
    if (mediaItemId && !assetPath) return "Bilde mangler (mediearkiv)";
    if (!assetPath) return "Ingen bilde valgt";
    return null;
  }
  if (type === "banners") {
    const items = Array.isArray(data.items) ? data.items : [];
    const withMedia = items.filter(
      (it: unknown) =>
        it && typeof it === "object" && (String((it as Record<string, unknown>).imageUrl ?? "").trim() || String((it as Record<string, unknown>).videoUrl ?? "").trim())
    ).length;
    if (items.length > 0 && withMedia === 0) return "Bannere uten bilde/video";
    return null;
  }
  return null;
}

/** Safe small preview for canvas card: no scripts, text/snippet only */
function defaultPreview(block: BlockCanvasBlock, getBlockSummary?: (b: BlockCanvasBlock) => string): React.ReactNode {
  const label = getBlockLabel(block.type);
  const summary = getBlockSummary ? getBlockSummary(block) : "";
  const data = block.data ?? {};
  let snippet = summary;
  const mediaMsg = mediaSnippet(block.type, data);
  if (mediaMsg) {
    snippet = mediaMsg;
  } else if (block.type === "code" || block.type === "richText") {
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
      return defaultPreview(block, getBlockSummary);
    },
    [getBlockSummary, renderBlockPreview]
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
      <div
        className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 p-8 text-center"
        role="status"
        aria-label="Ingen blokker. Legg til en blokk for å bygge siden."
      >
        <Icon name="add" size="lg" className="mb-3 text-[rgb(var(--lp-muted))]/60" />
        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Ingen blokker</p>
        <p className="mt-1 max-w-[260px] text-xs text-[rgb(var(--lp-muted))]">
          Legg til innhold i listen til venstre, eller bruk knappen under.
        </p>
        {onAddAt && (
          <button
            type="button"
            onClick={() => onAddAt(0)}
            className="lp-motion-btn mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 border-[rgb(var(--lp-border))] bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-slate-400 hover:bg-[rgb(var(--lp-card))]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            aria-label="Legg til første blokk"
          >
            <Icon name="add" size="sm" />
            Legg til blokk
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
                className="h-1 flex-shrink-0 rounded-full bg-[rgb(var(--lp-text))] opacity-80 shadow-sm"
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
              className={`lp-motion-card group relative rounded-xl border bg-white ${
                isDragging ? "opacity-50 scale-[0.98]" : ""
              } ${isActive ? "ring-2 ring-[rgb(var(--lp-text))] ring-offset-2 border-[rgb(var(--lp-border))]" : "border-[rgb(var(--lp-border))] hover:border-slate-300 hover:shadow-[var(--lp-shadow-soft)]"}`}
              data-block-id={block.id}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={`Blokk: ${getBlockLabel(block.type)}`}
                onClick={() => onSelect(block.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(block.id);
                  }
                }}
                className="lp-motion-card flex cursor-pointer flex-col p-3 text-left outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-[10px] text-[rgb(var(--lp-muted))] active:cursor-grabbing"
                      title="Dra for å endre rekkefølge"
                      aria-label="Flytt blokk (dra for å endre rekkefølge)"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      ⠿
                    </span>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[rgb(var(--lp-card))] text-[10px] font-medium text-[rgb(var(--lp-text))]">
                      {typeIcon(block.type)}
                    </span>
                    <span className="truncate text-xs font-semibold text-[rgb(var(--lp-text))]">
                      {getBlockLabel(block.type)}
                    </span>
                    <span className="shrink-0 text-[10px] text-[rgb(var(--lp-muted))]">#{index + 1}</span>
                  </div>
                  <div className="lp-motion-btn flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[selected]:opacity-100" data-selected={isActive ? "" : undefined}>
                    {index > 0 && (
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] hover:text-[rgb(var(--lp-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                        title="Flytt opp"
                        aria-label={`Flytt blokk ${index + 1} opp`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove(index, index - 1);
                        }}
                      >
                        <Icon name="chevronUp" size="sm" />
                      </button>
                    )}
                    {index < blocks.length - 1 && (
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] hover:text-[rgb(var(--lp-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                        title="Flytt ned"
                        aria-label={`Flytt blokk ${index + 1} ned`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove(index, index + 1);
                        }}
                      >
                        <Icon name="chevronDown" size="sm" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex h-7 items-center justify-center gap-1 rounded border border-red-200 px-1.5 text-[10px] text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1"
                      title="Fjern blokk"
                      aria-label={`Fjern blokk ${index + 1}`}
                      onClick={(e) => handleRemoveClick(e, block.id)}
                    >
                      <Icon name="delete" size="sm" />
                      Fjern
                    </button>
                  </div>
                </div>
                <div className="mt-1 min-h-[20px] rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-2 py-1.5">
                  {previewFor(block)}
                </div>
              </div>
            </div>
            {showDropAfter && (
              <div
                className="min-h-[6px] flex-shrink-0 rounded-full bg-[rgb(var(--lp-ring))]/90 shadow-sm ring-1 ring-[rgb(var(--lp-border))]"
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
          className="lp-motion-btn mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] py-2.5 text-sm text-[rgb(var(--lp-muted))] hover:border-slate-400 hover:bg-[rgb(var(--lp-card))]/50 hover:text-[rgb(var(--lp-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
          aria-label="Legg til blokk på slutten"
        >
          <Icon name="add" size="sm" />
          Legg til blokk
        </button>
      )}
    </div>
  );
}
