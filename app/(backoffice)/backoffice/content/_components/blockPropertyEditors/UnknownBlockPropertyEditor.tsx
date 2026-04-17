"use client";

import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { Block } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";

function safeJsonPreview(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Trygg fallback når `block.type` ikke matcher en kjent editor (fremtidige typer eller korrupt data).
 * Krasjer ikke — viser type, id og en begrenset råvisning.
 */
export function UnknownBlockPropertyEditor(props: {
  block: Block;
  ctx: BlockInspectorFieldsCtx;
  /** Når runtime-type avviker fra union (f.eks. ny CMS-type før types oppdateres). */
  reportedType?: string;
}) {
  const { block, reportedType } = props;
  const typeLabel =
    reportedType ??
    (typeof (block as { type?: unknown }).type === "string"
      ? String((block as { type: string }).type)
      : "ukjent");

  return (
    <div className="grid gap-3" data-lp-property-editor-root="unknown">
      <PropertyEditorSection section="content" overline="Blokk">
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Ingen dedikert editor for denne blokktypen ennå.</p>
          <p className="mt-1 text-[13px] text-amber-900/90">
            Du kan fortsatt flytte eller slette blokken fra dokumentet. Lagre og publiser som vanlig når
            redaksjonell flyt tillater det.
          </p>
        </div>
        <dl className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="text-[rgb(var(--lp-muted))]">Type</dt>
            <dd className="font-mono text-[13px] text-[rgb(var(--lp-text))]">{typeLabel}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="text-[rgb(var(--lp-muted))]">Blokk-ID</dt>
            <dd className="break-all font-mono text-[13px] text-[rgb(var(--lp-text))]">{block.id}</dd>
          </div>
        </dl>
        <details className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2">
          <summary className="cursor-pointer text-[13px] text-[rgb(var(--lp-muted))]">
            Teknisk forhåndsvisning (skrivebeskyttet)
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[rgb(var(--lp-text))]">
            {safeJsonPreview(block)}
          </pre>
        </details>
      </PropertyEditorSection>
    </div>
  );
}
