"use client";

import type { BlockQualityLevel } from "@/lib/cms/editorSmartHints";

function levelEmoji(level: BlockQualityLevel): string {
  if (level === "good") return "🟢";
  if (level === "warn") return "🟡";
  return "🔴";
}

function levelNorwegian(level: BlockQualityLevel): string {
  if (level === "good") return "Bra";
  if (level === "warn") return "Kan forbedres";
  return "Mangler / svak";
}

export type BlockQualityMeterProps = {
  score: number;
  level: BlockQualityLevel;
  className?: string;
};

/**
 * Compact, explainable block score — never auto-changes content.
 */
export function BlockQualityMeter({ score, level, className }: BlockQualityMeterProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-2.5 py-2 text-xs ${className ?? ""}`}
      role="status"
      aria-label={`Blokkscore ${score} av 100. ${levelNorwegian(level)}.`}
    >
      <span className="font-semibold tabular-nums text-[rgb(var(--lp-text))]">{score}</span>
      <span className="text-[rgb(var(--lp-muted))]">/ 100</span>
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--lp-border))]/60 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[rgb(var(--lp-text))]">
        <span aria-hidden>{levelEmoji(level)}</span>
        {levelNorwegian(level)}
      </span>
    </div>
  );
}
