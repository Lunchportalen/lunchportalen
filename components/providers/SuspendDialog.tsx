"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { LIFECYCLE_REASON_MIN_LENGTH } from "@/lib/providers/lifecycleReason";

export type SuspendDialogVariant = "suspend" | "pause" | "delete" | "resume";

export type SuspendDialogProps = {
  open: boolean;
  variant: SuspendDialogVariant;
  entityName: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
};

export default function SuspendDialog({
  open,
  variant,
  entityName,
  loading = false,
  error = null,
  onCancel,
  onConfirm,
}: SuspendDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [reason, setReason] = useState("");
  const t = useTranslations("provider.customers.lifecycle.dialog");
  const needsReason = variant !== "resume";
  const reasonLen = reason.trim().length;
  const reasonOk = !needsReason || reasonLen >= LIFECYCLE_REASON_MIN_LENGTH;

  useEffect(() => {
    if (!open) {
      setReason("");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div className="ds-provider-dialog-root">
      <button
        type="button"
        className="ds-provider-drawer-backdrop"
        aria-label={t("closeAria")}
        disabled={loading}
        onClick={onCancel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="ds-provider-dialog"
      >
        <h2 id={titleId} className="ds-h2">
          {t(`${variant}.title`, { name: entityName })}
        </h2>
        <p id={descId} className="ds-body">
          {t(`${variant}.description`)}
        </p>

        {needsReason ? (
          <div className="lp-demo-form">
            <label htmlFor={`${titleId}-reason`}>{t("reasonLabel")}</label>
            <textarea
              id={`${titleId}-reason`}
              name="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              aria-invalid={reasonLen > 0 && !reasonOk}
              aria-describedby={`${titleId}-reason-hint`}
            />
            <p id={`${titleId}-reason-hint`} className="ds-provider-activity__meta">
              {t("reasonHint", { current: reasonLen, min: LIFECYCLE_REASON_MIN_LENGTH })}
              {reasonLen > 0 && !reasonOk ? t("reasonNeedMore") : ""}
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="lp-demo-form__status is-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ds-provider-dialog__actions">
          <button type="button" className="ds-btn ds-btn--secondary" disabled={loading} onClick={onCancel}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={loading || !reasonOk}
            onClick={() => void onConfirm(needsReason ? reason.trim() : undefined)}
          >
            {loading ? t("working") : t(`${variant}.confirm`)}
          </button>
        </div>
      </div>
    </div>
  );
}
