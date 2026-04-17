"use client";

import { BlockQualityMeter } from "@/components/cms";
import { analyzeBlock } from "@/lib/cms/editorSmartHints";
import { PropertyEditorSection } from "./PropertyEditorSection";

type BlockQuality = ReturnType<typeof analyzeBlock>;

export function BlockInspectorQualityInner({ blockQuality }: { blockQuality: BlockQuality }) {
  return (
    <>
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
    </>
  );
}

export function BlockInspectorQualitySectionOpen({ blockQuality }: { blockQuality: BlockQuality }) {
  return (
    <PropertyEditorSection section="content" overline="Kvalitet · veiledning">
      <BlockInspectorQualityInner blockQuality={blockQuality} />
    </PropertyEditorSection>
  );
}

/** Kun innholdsside detail: sammenleggbar kvalitet under egenskapsflaten. */
export function BlockInspectorQualitySectionDetailCollapsed({
  blockQuality,
  tone = "default",
}: {
  blockQuality: BlockQuality;
  /** Mindre panel-tyngde når kvalitet ligger under innebygd seksjonseditor. */
  tone?: "default" | "embeddedQuiet";
}) {
  const quiet = tone === "embeddedQuiet";
  return (
    <details
      className={
        quiet
          ? "rounded-md border border-slate-100/90 bg-white/50 py-1.5 pl-2 pr-2 shadow-none"
          : "rounded-lg border border-slate-200/90 bg-slate-50/80 pl-2.5 pr-2 py-2 shadow-[inset_3px_0_0_rgba(100,116,139,0.35)]"
      }
      data-lp-inspector-quality-fold
    >
      <summary
        className={`cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden ${
          quiet
            ? "text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400"
            : "text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600"
        }`}
      >
        Kvalitet · veiledning
      </summary>
      <div
        className={`mt-2 grid gap-2 pt-2 ${quiet ? "border-t border-slate-100/80" : "border-t border-[rgb(var(--lp-border))]/60"}`}
      >
        <BlockInspectorQualityInner blockQuality={blockQuality} />
      </div>
    </details>
  );
}
