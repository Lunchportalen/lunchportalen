"use client";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { truncate } from "./canvasPreviewUtils";

function countCompleteFromFlat(flat: Record<string, unknown>): { total: number; complete: number } {
  const steps = Array.isArray(flat.steps) ? flat.steps : [];
  let complete = 0;
  for (const raw of steps) {
    const st = raw as { imageId?: string; title?: string; text?: string };
    const img = String(st.imageId ?? "").trim();
    if (String(st.title ?? "").trim() && String(st.text ?? "").trim() && img) complete += 1;
  }
  return { total: steps.length, complete };
}

/** U91: flat projection = samme som editor. */
export function StepsCanvasPreview({ block }: { block: Extract<Block, { type: "zigzag" }> }) {
  const flat = getBlockEntryFlatForRender(block);
  const { total, complete } = countCompleteFromFlat(flat);
  const isFaq = flat.presentation === "faq";
  const mode = isFaq ? "FAQ" : "Prosess";
  const t = String(flat.title || "").trim();
  const introOk = String(flat.intro || "").trim().length > 0;
  const nShow = Math.min(Math.max(total, 0), isFaq ? 4 : 5);

  return (
    <div
      className={`min-w-0 rounded-xl border p-3 ${
        isFaq
          ? "border-violet-200/70 bg-gradient-to-b from-violet-50/50 to-white"
          : "border-sky-200/60 bg-gradient-to-b from-white to-sky-50/40"
      }`}
      data-lp-block-preview
      data-lp-block-preview-kind="zigzag"
      data-lp-canvas-view="steps"
      data-lp-preview-steps-mode={isFaq ? "faq" : "process"}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {isFaq ? "Modul · spørsmål/svar" : "Modul · steg for steg"}
          </p>
          <p className="mt-0.5 text-[12px] font-bold text-slate-900 line-clamp-2">{t ? truncate(t, 80) : "Uten seksjonstittel"}</p>
          <p className="mt-1 text-[10px] font-medium text-slate-500">
            {total} steg · {complete} komplette · {introOk ? "Ingress aktiv" : "Uten ingress"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
            isFaq ? "bg-violet-100 text-violet-900 ring-1 ring-violet-200/90" : "bg-sky-100 text-sky-900 ring-1 ring-sky-200/90"
          }`}
        >
          {mode}
        </span>
      </div>

      {isFaq ? (
        <div className="space-y-2" data-lp-preview-step-stack aria-hidden>
          {Array.from({ length: Math.max(nShow, 1) }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-violet-100/90 bg-white/95 px-2.5 py-2 shadow-[inset_3px_0_0_rgba(139,92,246,0.35)]"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-[11px] font-black text-violet-600">Q{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="block h-2 w-[88%] rounded bg-violet-200/80" />
                  <span className="block h-2 w-full rounded bg-slate-200/85" />
                  <span className="block h-1.5 w-[72%] rounded bg-slate-200/65" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1 overflow-x-auto pb-1" data-lp-preview-step-stack aria-hidden>
          {Array.from({ length: Math.max(nShow, 1) }).map((_, i) => (
            <div key={i} className="flex min-w-0 flex-1 items-center">
              <div className="flex flex-1 flex-col items-center gap-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-sky-300 bg-white text-[11px] font-bold text-sky-900 shadow-sm">
                  {i + 1}
                </span>
                <span className="h-2 w-[92%] max-w-[64px] rounded-md bg-slate-200/90" />
                <span className="h-1.5 w-[72%] max-w-[48px] rounded-md bg-slate-200/65" />
              </div>
              {i < Math.max(nShow, 1) - 1 ? (
                <span className="mx-1 h-px min-w-[12px] flex-1 rounded-full bg-gradient-to-r from-sky-300 to-slate-200" />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
