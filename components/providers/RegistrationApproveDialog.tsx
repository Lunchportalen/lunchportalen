"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  approveProviderRegistration,
  rejectProviderRegistration,
} from "@/app/leverandor/registreringer/actions";
import type { ProviderRegistrationRow } from "@/lib/providers/loadProviderRegistrations";
import { resolveProviderRegistrationActionError } from "@/lib/providers/providerRegistrationActionErrors";

export type RegistrationApproveDialogProps = {
  open: boolean;
  providerId: string;
  registration: ProviderRegistrationRow | null;
  onClose: () => void;
  onDone: () => void;
};

export default function RegistrationApproveDialog({
  open,
  providerId,
  registration,
  onClose,
  onDone,
}: RegistrationApproveDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [tier, setTier] = useState<"BASIS" | "LUXUS">("BASIS");
  const [rejectReason, setRejectReason] = useState("");
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tDialog = useTranslations("provider.registrations.dialogs");
  const tErrors = useTranslations("provider.registrations.errors");

  useEffect(() => {
    if (!open) {
      setError(null);
      setRejectReason("");
      setMode("approve");
      setTier("BASIS");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !registration) return null;

  function onConfirm() {
    if (!registration) return;
    setError(null);
    startTransition(async () => {
      const res =
        mode === "approve"
          ? await approveProviderRegistration(providerId, registration.id, tier)
          : await rejectProviderRegistration(providerId, registration.id, rejectReason);

      if (res.success === false) {
        setError(resolveProviderRegistrationActionError((key) => tErrors(key), res));
        return;
      }
      onDone();
      onClose();
    });
  }

  return (
    <>
      <button type="button" className="ds-provider-drawer-backdrop" aria-label={tDialog("closeAria")} onClick={onClose} />
      <div
        ref={panelRef}
        className="ds-provider-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="ds-h3">
          {mode === "approve" ? tDialog("approveTitle") : tDialog("rejectTitle")}
        </h2>
        <p className="ds-body">
          <strong>{registration.company_name}</strong> · {registration.orgnr} · {registration.city}{" "}
          {registration.postal_code}
        </p>
        <dl className="ds-provider-reg-detail">
          <div>
            <dt>{tDialog("contactLabel")}</dt>
            <dd>
              {registration.contact_name} · {registration.contact_email}
            </dd>
          </div>
          <div>
            <dt>{tDialog("phoneLabel")}</dt>
            <dd>{registration.contact_phone}</dd>
          </div>
          <div>
            <dt>{tDialog("employeesLabel")}</dt>
            <dd>{registration.employee_count ?? "—"}</dd>
          </div>
        </dl>

        {mode === "approve" ? (
          <div className="lp-demo-form">
            <label htmlFor="reg-tier">{tDialog("tierLabel")}</label>
            <select
              id="reg-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as "BASIS" | "LUXUS")}
            >
              <option value="BASIS">BASIS</option>
              <option value="LUXUS">LUXUS</option>
            </select>
          </div>
        ) : (
          <div className="lp-demo-form">
            <label htmlFor="reg-reject-reason">{tDialog("rejectReasonLabel")}</label>
            <textarea
              id="reg-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
            />
          </div>
        )}

        {error ? (
          <p className="lp-demo-form__status is-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ds-provider-dialog__actions">
          {mode === "approve" ? (
            <button
              type="button"
              className="ds-btn ds-btn--secondary"
              onClick={() => setMode("reject")}
              disabled={pending}
            >
              {tDialog("rejectInstead")}
            </button>
          ) : (
            <button
              type="button"
              className="ds-btn ds-btn--secondary"
              onClick={() => setMode("approve")}
              disabled={pending}
            >
              {tDialog("approveInstead")}
            </button>
          )}
          <button type="button" className="ds-btn ds-btn--secondary" onClick={onClose} disabled={pending}>
            {tDialog("cancel")}
          </button>
          <button type="button" className="ds-btn ds-btn--primary" onClick={onConfirm} disabled={pending}>
            {pending ? tDialog("saving") : mode === "approve" ? tDialog("approve") : tDialog("reject")}
          </button>
        </div>
      </div>
    </>
  );
}
