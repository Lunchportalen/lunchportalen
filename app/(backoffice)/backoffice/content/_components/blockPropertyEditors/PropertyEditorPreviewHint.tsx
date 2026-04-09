"use client";

import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";

type Props = { blockType?: string };

/** Visible coupling: inspector edits flow to the same block value the canvas reads; validation hints from block contract. */
export function PropertyEditorPreviewHint(props: Props) {
  const { blockType } = props;
  const canon = blockType ? getBlockTypeDefinition(blockType) : undefined;
  const rules = canon?.validationRules ?? [];

  return (
    <div className="grid gap-1">
      <p
        className="rounded-md border border-[rgb(var(--lp-border))]/60 bg-[rgb(var(--lp-card))]/30 px-2 py-1 text-[10px] text-[rgb(var(--lp-muted))]"
        data-lp-pe-preview-hint
      >
        Forhåndsvisning på canvas følger denne blokken — samme datasett som lagring
        {canon?.canvasViewComponent ? (
          <>
            {" "}
            (<span data-lp-pe-canvas-coupling>{canon.canvasViewComponent}</span>)
          </>
        ) : null}
        .
      </p>
      {rules.length > 0 ? (
        <ul
          className="list-inside list-disc rounded-md border border-dashed border-[rgb(var(--lp-border))]/50 bg-white/40 px-2 py-1 text-[10px] text-[rgb(var(--lp-text))]"
          data-lp-pe-validation-hints
        >
          {rules.map((r) => (
            <li key={r.id}>{r.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
