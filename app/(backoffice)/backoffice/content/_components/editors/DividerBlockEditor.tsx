"use client";

import type { DividerBlock } from "../editorBlockTypes";

type DividerBlockEditorProps = {
  block: DividerBlock;
  onChange: (next: DividerBlock) => void;
};

export function DividerBlockEditor({ block, onChange }: DividerBlockEditorProps) {
  const style = block.style ?? "line";
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Utseende</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...block, style: "line" })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${style === "line" ? "border-slate-400 bg-slate-100 text-slate-900" : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-text))]"}`}
          >
            Linje
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...block, style: "space" })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${style === "space" ? "border-slate-400 bg-slate-100 text-slate-900" : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-text))]"}`}
          >
            Mellomrom
          </button>
        </div>
      </label>
    </div>
  );
}
