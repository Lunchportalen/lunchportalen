"use client";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { truncate } from "./canvasPreviewUtils";

/** U91: flat projection = samme som editor. */
export function RelatedLinksCanvasPreview({ block }: { block: Extract<Block, { type: "relatedLinks" }> }) {
  const flat = getBlockEntryFlatForRender(block);
  const tags = Array.isArray(flat.tags) ? flat.tags : [];
  const n = tags.length;
  const max = flat.maxSuggestions;
  const introOk = String(flat.subtitle || "").trim().length > 0;
  const fb = String(flat.emptyFallbackText || "").trim() ? "Egen tomtekst" : "Standard tomtilstand";
  const path = String(flat.currentPath || "").trim();
  const title = String(flat.title || "").trim();

  const rows = [
    { k: "a", w: "w-[92%]" },
    { k: "b", w: "w-[84%]" },
    { k: "c", w: "w-[72%]" },
  ];

  return (
    <div
      className="min-w-0 rounded-xl border border-indigo-200/60 bg-gradient-to-b from-indigo-50/45 to-white p-3"
      data-lp-block-preview
      data-lp-block-preview-kind="relatedLinks"
      data-lp-canvas-view="relatedLinks"
    >
      <div className="mb-2 border-b border-indigo-100/90 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-indigo-900">Kuraterte lenker</p>
        <p className="mt-1 text-[13px] font-bold text-slate-900 line-clamp-2">{title ? truncate(title, 84) : "Relaterte sider"}</p>
        {introOk ? (
          <p className="mt-1 text-[10px] font-medium text-slate-600 line-clamp-2">Ingress aktiv · styrt av stikkord og maks antall</p>
        ) : (
          <p className="mt-1 text-[10px] italic text-slate-400">Uten ingress — fortsatt kuratert liste</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[9px] font-bold" data-lp-preview-related-strip>
          <span className="rounded-full bg-white px-2 py-0.5 text-indigo-900 ring-1 ring-indigo-200/80">{n} stikkord</span>
          <span className="h-3 w-px bg-indigo-200" aria-hidden />
          <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200/80">
            {max != null ? `Maks ${max}` : "Maks auto"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{fb}</span>
        </div>
      </div>
      <ul className="space-y-1.5" aria-hidden>
        {rows.map((r) => (
          <li
            key={r.k}
            className="flex items-center gap-2 rounded-lg border border-indigo-100/80 bg-white px-2 py-2 shadow-sm"
          >
            <span className="text-[11px] font-bold text-indigo-400">↗</span>
            <span className={`block h-2 rounded bg-indigo-100/90 ${r.w}`} />
          </li>
        ))}
      </ul>
      {path ? (
        <p className="mt-2 truncate text-[9px] font-mono text-slate-400" title={path}>
          Sti: {path}
        </p>
      ) : null}
    </div>
  );
}
