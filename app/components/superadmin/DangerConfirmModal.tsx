"use client";

import { useMemo, useState } from "react";

export default function DangerConfirmModal({
  open,
  title,
  description,
  confirmText,
  requiredPhrase,
  confirmLabel = "Bekreft",
  cancelLabel = "Avbryt",
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  requiredPhrase: string; // e.g. company name
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  busy?: boolean;
}) {
  const [value, setValue] = useState("");
  const ok = useMemo(
    () => value.trim().toLowerCase() === requiredPhrase.trim().toLowerCase(),
    [value, requiredPhrase]
  );

  if (!open) return null;

  return (
    <div className="lp-modalOverlay">
      <div className="lp-modal">
        <div className="lp-modalHeader">
          <div className="text-lg font-semibold">{title}</div>
          <div className="mt-2 text-sm text-muted">{description}</div>
          {confirmText && (
            <div className="mt-3 rounded-xl border bg-bg p-3 text-sm">
              {confirmText}
            </div>
          )}
        </div>

        <div className="lp-modalBody">
          <div className="lp-label mb-2">Skriv inn: <span className="font-semibold">{requiredPhrase}</span></div>
          <input
            className="lp-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={requiredPhrase}
            autoFocus
          />
        </div>

        <div className="lp-modalActions">
          <button className="lp-btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className="lp-btn-primary"
            onClick={onConfirm}
            disabled={!ok || busy}
            aria-disabled={!ok || busy}
          >
            {busy ? "Jobber…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
