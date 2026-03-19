"use client";

/**
 * Inline AI actions: Improve, Rewrite, Expand.
 * Shown in block inspector row for text-capable blocks. Buttons only; parent wires handlers.
 */

export type InlineAiActionsProps = {
  onImprove: () => void;
  onRewrite: () => void;
  onExpand: () => void;
  disabled?: boolean;
  /** Optional: one of the actions is busy. */
  busyAction?: "improve" | "rewrite" | "expand" | null;
};

const btnClass =
  "min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs hover:bg-[rgb(var(--lp-card))] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1";

export function InlineAiActions({
  onImprove,
  onRewrite,
  onExpand,
  disabled = false,
  busyAction = null,
}: InlineAiActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="AI-handlinger">
      <button
        type="button"
        onClick={onImprove}
        disabled={disabled}
        className={btnClass}
        title="Forbedre innhold med AI"
        aria-label="Forbedre"
      >
        {busyAction === "improve" ? "…" : "Forbedre"}
      </button>
      <button
        type="button"
        onClick={onRewrite}
        disabled={disabled}
        className={btnClass}
        title="Omskriv med AI"
        aria-label="Omskriv"
      >
        {busyAction === "rewrite" ? "…" : "Omskriv"}
      </button>
      <button
        type="button"
        onClick={onExpand}
        disabled={disabled}
        className={btnClass}
        title="Utvid innhold med AI"
        aria-label="Utvid"
      >
        {busyAction === "expand" ? "…" : "Utvid"}
      </button>
    </div>
  );
}
