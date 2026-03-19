"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { motionClasses } from "@/lib/ui/motionTokens";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type ContentSaveBarProps = {
  selectedId: string;
  saving: boolean;
  canSave: boolean;
  onSaveAndPreview: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  /** Shown when last save failed (error/conflict/offline). User must see why save did not complete. */
  saveError?: string | null;
  /** When set and not saving/error, show "Sist lagret: …" for confidence. */
  lastSavedAt?: string | null;
  /** Format lastSavedAt for display. */
  formatDate?: (value: string | null | undefined) => string;
};

export function ContentSaveBar({
  selectedId,
  saving,
  canSave,
  onSaveAndPreview,
  onSave,
  saveError,
  lastSavedAt,
  formatDate,
}: ContentSaveBarProps) {
  const showSavedFeedback = !saving && !saveError && lastSavedAt != null && formatDate;
  const savedLabel = showSavedFeedback ? formatDate(lastSavedAt) : null;
  const [showSuccess, setShowSuccess] = useState(false);
  const prevSavedAtRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (lastSavedAt == null) return;
    if (prevSavedAtRef.current !== undefined && prevSavedAtRef.current !== lastSavedAt) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 400);
      prevSavedAtRef.current = lastSavedAt;
      return () => clearTimeout(t);
    }
    prevSavedAtRef.current = lastSavedAt;
  }, [lastSavedAt]);

  return (
    <div className="font-ui lp-glass-bar flex flex-col gap-3 px-4 py-3">
      {saveError && (
        <div className="flex w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs" role="alert">
          <Icon name="warning" size="sm" className="text-amber-600 shrink-0" />
          <span className="text-amber-800">{saveError}</span>
        </div>
      )}
      {saving && (
        <span className="flex items-center gap-2 text-xs font-medium text-[rgb(var(--lp-muted))]" role="status">
          <Icon name="loading" size="sm" className="animate-spin shrink-0" />
          Lagrer…
        </span>
      )}
      {showSavedFeedback && (
        <span
          className={cn("text-xs text-[rgb(var(--lp-muted))]", showSuccess && motionClasses.success)}
          role="status"
        >
          Sist lagret {savedLabel}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onSaveAndPreview()}
          disabled={!selectedId || saving}
          title="Lagre og åpne forhåndsvisning i ny fane"
          aria-label="Lagre og åpne forhåndsvisning"
        >
          Lagre og forhåndsvis
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onSave()}
          disabled={!canSave}
          title={saving ? "Lagrer…" : "Lagre endringer uten å åpne forhåndsvisning"}
          aria-label={saving ? "Lagrer" : "Lagre"}
        >
          {saving ? (
            <>
              <Icon name="loading" size="sm" className="animate-spin shrink-0" />
              Lagrer…
            </>
          ) : (
            "Lagre"
          )}
        </Button>
      </div>
    </div>
  );
}

