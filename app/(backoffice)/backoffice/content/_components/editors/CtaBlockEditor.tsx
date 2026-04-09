"use client";

import type { CtaBlock } from "../editorBlockTypes";

type CtaBlockEditorProps = {
  block: CtaBlock;
  onChange: (next: CtaBlock) => void;
};

export function CtaBlockEditor({ block, onChange }: CtaBlockEditorProps) {
  const c = block.contentData;
  const s = block.structureData;
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Tittel</span>
        <input
          value={c.title}
          onChange={(e) =>
            onChange({
              ...block,
              contentData: { ...block.contentData, title: e.target.value },
            })
          }
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Brødtekst</span>
        <textarea
          value={c.body || ""}
          onChange={(e) =>
            onChange({
              ...block,
              contentData: { ...block.contentData, body: e.target.value },
            })
          }
          className="min-h-24 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Knappetekst</span>
          <input
            value={s.buttonLabel || ""}
            onChange={(e) =>
              onChange({
                ...block,
                structureData: { ...block.structureData, buttonLabel: e.target.value },
              })
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Knappelenke</span>
          <input
            value={s.buttonHref || ""}
            onChange={(e) =>
              onChange({
                ...block,
                structureData: { ...block.structureData, buttonHref: e.target.value },
              })
            }
            placeholder="https://..."
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
