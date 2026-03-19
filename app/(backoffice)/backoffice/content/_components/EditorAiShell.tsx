"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { motionClasses } from "@/lib/ui/motionTokens";
import {
  skeletonVariantClasses,
  errorVariantClasses,
  successVariantClasses,
} from "@/lib/ui/stateSurfaceVariants";

export type EditorAiShellStatus =
  | "idle"
  | "generating"
  | "result_ready"
  | "apply_pending"
  | "applied"
  | "failed";

export type EditorAiShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  contextLabel: string;
  status: EditorAiShellStatus;
  errorMessage?: string | null;
  /** Prompt / action area (e.g. input or primary CTA). Rendered when status is idle or between states. */
  promptContent?: ReactNode;
  /** Result area override when status is result_ready. If not provided, shell shows default placeholder. */
  resultContent?: ReactNode;
  /** Footer actions. Default: single Lukk button that calls onClose. */
  footerActions?: ReactNode;
  /** Accessible dialog label (default: title). */
  ariaLabel?: string;
};

/**
 * Reusable AI shell surface for the CMS editor.
 * Modal with: title/header, context label, prompt area, result area (with idle/generating/result_ready/failed placeholders), footer.
 * Uses existing Lunchportalen overlay/panel and state-surface primitives. No business logic; structural only.
 */
export function EditorAiShell({
  open,
  onClose,
  title,
  contextLabel,
  status,
  errorMessage,
  promptContent,
  resultContent,
  footerActions,
  ariaLabel = title,
}: EditorAiShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="lp-motion-overlay lp-glass-overlay fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="lp-motion-card lp-glass-panel flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title + context + close */}
        <div className="flex items-center justify-between border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">{title}</h2>
            <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">{contextLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            aria-label="Lukk"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Error strip (failed state) */}
        {status === "failed" && errorMessage ? (
          <div
            className={errorVariantClasses.outline}
            role="alert"
          >
            <div className="flex items-start gap-2 px-4 py-3">
              <Icon name="warning" size="sm" className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-red-800">Noe gikk galt</p>
                <p className="mt-0.5 text-[11px] text-red-700">{errorMessage}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Prompt / action area */}
        <div className="border-b border-[rgb(var(--lp-border))] px-4 py-3">
          {promptContent ?? (
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Beskriv hva du vil forbedre, eller bruk handlingen nedenfor. Resultat vises under.
            </p>
          )}
        </div>

        {/* Result area: placeholder by status */}
        <div className="min-h-[120px] flex-1 overflow-auto px-4 py-3">
          {status === "generating" ? (
            <div
              className={skeletonVariantClasses.outline + " p-4 rounded-lg"}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className={motionClasses.skeleton + " h-4 w-3/4 rounded"} aria-hidden />
              <div className={motionClasses.skeleton + " mt-2 h-4 w-1/2 rounded"} aria-hidden />
              <div className={motionClasses.skeleton + " mt-3 h-8 w-full rounded"} aria-hidden />
              <div className="mt-3 flex items-center gap-2 text-[11px] text-[rgb(var(--lp-muted))]">
                <Icon name="loading" size="sm" className="animate-spin" aria-hidden />
                <span>Genererer…</span>
              </div>
            </div>
          ) : status === "result_ready" ? (
            resultContent ?? (
              <div className={successVariantClasses.outline + " flex flex-col items-center justify-center rounded-lg p-6 text-center"}>
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Resultat klar</p>
                <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
                  Forhåndsvisning eller bruk-knapp kobles til i neste steg.
                </p>
              </div>
            )
          ) : status === "apply_pending" ? (
            <div className={skeletonVariantClasses.outline + " flex flex-col items-center justify-center rounded-lg p-6 text-center"}>
              <Icon name="loading" size="sm" className="animate-spin text-[rgb(var(--lp-muted))]" aria-hidden />
              <p className="mt-2 text-sm font-medium text-[rgb(var(--lp-text))]">Bruker forslag…</p>
              <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">Blokken oppdateres.</p>
            </div>
          ) : status === "applied" ? (
            <div
              className={successVariantClasses.outline + " flex flex-col items-center justify-center rounded-lg p-6 text-center"}
              role="status"
              aria-live="polite"
            >
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Bruk tatt</p>
              <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
                Du kan lukke eller generere på nytt.
              </p>
            </div>
          ) : status === "failed" ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-4 py-8 text-center">
              <p className="text-[11px] text-[rgb(var(--lp-muted))]">
                Feilmelding vises over. Prøv igjen eller lukk.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-4 py-8 text-center">
              <p className="text-[11px] text-[rgb(var(--lp-muted))]">
                Resultat vises her når AI har generert forslag.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[rgb(var(--lp-border))] px-4 py-2">
          {footerActions ?? (
            <button
              type="button"
              onClick={onClose}
              className="lp-motion-btn min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            >
              Lukk
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
