"use client";

import { BlockQualityMeter } from "@/components/cms";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { analyzeBlock } from "@/lib/cms/editorSmartHints";
import type { Block } from "./editorBlockTypes";
import { getBlockInspectorLead } from "./blockInspectorLead";
import { BlockPropertyEditorRouter } from "./blockPropertyEditors/BlockPropertyEditorRouter";
import { PropertyEditorSection } from "./PropertyEditorSection";

export type { BlockInspectorFieldsCtx, RichTextInlineState } from "./blockPropertyEditorContract";

export function BlockInspectorFields({
  block,
  ctx,
}: {
  block: Block;
  ctx: import("./blockPropertyEditorContract").BlockInspectorFieldsCtx;
}) {
  const blockQuality = analyzeBlock(block);
  const def = getBlockTypeDefinition(block.type);

  return (
    <div
      className="grid gap-2"
      data-lp-inspector-fields
      data-lp-inspector-type={block.type}
      data-lp-property-editor-contract={block.type}
      data-lp-pe-model="content-settings-structure"
      data-lp-inspector-pe-router="blockPropertyEditors"
    >
      <div
        className="rounded-lg border border-[rgb(var(--lp-border))]/80 bg-[rgb(var(--lp-card))]/20 px-2.5 py-2"
        data-lp-inspector-block-identity
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-pink-900/55">Valgt blokk</p>
        <p className="text-sm font-semibold text-[rgb(var(--lp-text))]" data-lp-inspector-block-title>
          {def?.title ?? block.type}
        </p>
        <p className="text-[10px] font-mono text-[rgb(var(--lp-muted))]" data-lp-inspector-block-alias>
          {block.type}
        </p>
        {def?.propertyEditorComponent ? (
          <p className="mt-0.5 text-[10px] text-[rgb(var(--lp-muted))]" data-lp-inspector-pe-component>
            Property editor: <span className="font-medium text-[rgb(var(--lp-text))]">{def.propertyEditorComponent}</span>
          </p>
        ) : null}
        <p
          className="mt-1 text-[11px] font-medium leading-snug text-[rgb(var(--lp-muted))]"
          data-lp-inspector-lead
        >
          {getBlockInspectorLead(block)}
        </p>
        {def &&
        (def.contentSections.length > 0 || def.settingsSections.length > 0 || def.structureSections.length > 0) ? (
          <div className="mt-2 flex flex-wrap gap-1" data-lp-inspector-section-contract>
            {def.contentSections.length > 0 ? (
              <span className="rounded border border-pink-900/15 bg-pink-50/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-pink-900/70">
                Innhold · {def.contentSections.length}
              </span>
            ) : null}
            {def.settingsSections.length > 0 ? (
              <span className="rounded border border-slate-300/40 bg-slate-50/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                Innstillinger · {def.settingsSections.length}
              </span>
            ) : null}
            {def.structureSections.length > 0 ? (
              <span className="rounded border border-emerald-900/15 bg-emerald-50/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-900/70">
                Struktur · {def.structureSections.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <PropertyEditorSection section="content" overline="Kvalitet · veiledning">
        <BlockQualityMeter score={blockQuality.score} level={blockQuality.level} />
        {blockQuality.hints.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-[rgb(var(--lp-text))]">
            {blockQuality.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        ) : null}
        {blockQuality.layoutIdeas.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5 text-[11px] font-medium text-[rgb(var(--lp-text))]">
            {blockQuality.layoutIdeas.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        ) : null}
      </PropertyEditorSection>
      <div data-lp-inspector-property-editor-surface className="grid gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-pink-900/45">Egenskapseditor</p>
        <BlockPropertyEditorRouter block={block} ctx={ctx} />
      </div>
    </div>
  );
}
