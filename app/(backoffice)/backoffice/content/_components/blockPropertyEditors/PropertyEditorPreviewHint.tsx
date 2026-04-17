"use client";

import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { useInspectorDeferredHintSlot } from "../inspectorDeferredHintSlotContext";

type Props = { blockType?: string };

/** Visible coupling: inspector edits flow to the same block value the canvas reads; validation hints from block contract. */
export function PropertyEditorPreviewHint(props: Props) {
  const { blockType } = props;
  const pathname = usePathname() ?? "";
  const isContentDetailEditor = resolveBackofficeContentRoute(pathname).kind === "detail";
  const deferredHintHost = useInspectorDeferredHintSlot();
  const canon = blockType ? getBlockTypeDefinition(blockType) : undefined;
  const rules = canon?.validationRules ?? [];

  const validationList =
    rules.length > 0 ? (
      <ul
        className={`list-inside list-disc text-[10px] text-[rgb(var(--lp-text))] ${
          isContentDetailEditor
            ? "mt-1 space-y-0.5 px-0.5"
            : "rounded-md border border-dashed border-[rgb(var(--lp-border))]/50 bg-white/40 px-2 py-1"
        }`}
        data-lp-pe-validation-hints
      >
        {rules.map((r) => (
          <li key={r.id}>{r.message}</li>
        ))}
      </ul>
    ) : null;

  if (isContentDetailEditor) {
    if (!validationList) return null;
    if (!deferredHintHost) return null;
    return createPortal(
      <details
        className="rounded-md border border-dashed border-[rgb(var(--lp-border))]/50 bg-white/40 px-2 py-1"
        data-lp-inspector-deferred-contract-hints
      >
        <summary className="cursor-pointer list-none text-[10px] font-medium text-[rgb(var(--lp-muted))] marker:content-none [&::-webkit-details-marker]:hidden">
          Kontrakt · validering
        </summary>
        {validationList}
      </details>,
      deferredHintHost,
    );
  }

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
      {validationList}
    </div>
  );
}
