"use client";

import type { CtaBlock } from "../editorBlockTypes";

type CtaBlockEditorProps = {
  block: CtaBlock;
  onChange: (next: CtaBlock) => void;
};

export function CtaBlockEditor({ block, onChange }: CtaBlockEditorProps) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Tittel</span>
        <input
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
          className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">Brødtekst</span>
        <textarea
          value={block.body || ""}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
          className="min-h-24 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Knappetekst</span>
          <input
            value={block.buttonLabel || ""}
            onChange={(e) => onChange({ ...block, buttonLabel: e.target.value })}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Knappelenke</span>
          <input
            value={block.buttonHref || ""}
            onChange={(e) => onChange({ ...block, buttonHref: e.target.value })}
            placeholder="https://..."
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
