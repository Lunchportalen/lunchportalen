"use client";

/**
 * CMS Design targeting: viser hvilket omfang brukeren jobber i (side valgt i tre + ev. blokk).
 * Global design åpnes via callback til Innhold og innstillinger → Generelt (samme preview-/publiseringskjede).
 */

import { getBlockShortLabel } from "./blockLabels";
import type { Block } from "./editorBlockTypes";

export type CmsDesignTargetingBarProps = {
  pageTitle: string;
  pageSlug: string | null | undefined;
  selectedBlock: Block | null;
  onNavigateToGlobalDesignSettings?: () => void;
};

export function CmsDesignTargetingBar({
  pageTitle,
  pageSlug,
  selectedBlock,
  onNavigateToGlobalDesignSettings,
}: CmsDesignTargetingBarProps) {
  return (
    <div
      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/80 px-3 py-2.5 shadow-[var(--lp-shadow-soft)] backdrop-blur-md"
      role="region"
      aria-label="CMS-design — omfang"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">CMS-design</p>
          <p className="mt-0.5 truncate text-sm font-medium text-[rgb(var(--lp-text))]">{pageTitle || "Uten tittel"}</p>
          <p className="truncate text-[11px] text-[rgb(var(--lp-muted))]">
            Omfang: <span className="font-medium text-[rgb(var(--lp-text))]">denne siden</span> · slug{" "}
            <span className="font-mono text-[rgb(var(--lp-text))]">{pageSlug?.trim() || "—"}</span>
            {selectedBlock ? (
              <>
                {" "}
                · blokk:{" "}
                <span className="font-medium text-[rgb(var(--lp-text))]">{getBlockShortLabel(selectedBlock.type)}</span>
                <span className="text-[rgb(var(--lp-muted))]"> (side → seksjon → blokk)</span>
              </>
            ) : (
              <span> · Side- og seksjonsdesign under Egenskaper → Innhold; velg blokk for blokknivå.</span>
            )}
          </p>
        </div>
        {onNavigateToGlobalDesignSettings ? (
          <button
            type="button"
            onClick={onNavigateToGlobalDesignSettings}
            className="min-h-11 shrink-0 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 text-xs font-semibold text-[rgb(var(--lp-text))] shadow-sm transition hover:-translate-y-px hover:border-pink-400/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/35"
          >
            Globalt design (tokens)
          </button>
        ) : null}
      </div>
    </div>
  );
}
