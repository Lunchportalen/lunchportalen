// components/admin/InviteEmployeeModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/copy/admin";

type Props = {
  open: boolean;
  onClose: () => void;

  /**
   * Kalles når bruker trykker "Send invitasjon".
   * Skal kaste Error (eller returnere {ok:false}) hvis noe feiler.
   */
  onSubmit: (payload: {
    name?: string | null;
    email: string;
    department?: string | null;
    locationId?: string | null;
    note?: string | null;
  }) => Promise<void>;

  /**
   * Lokasjoner (valgfritt). Hvis dere ikke har lokasjoner enda,
   * kan du sende tom liste eller undefined.
   */
  locations?: { id: string; name: string }[];

  /**
   * Default location (valgfritt)
   */
  defaultLocationId?: string | null;

  /**
   * UI-tekst (valgfritt override)
   */
  titleKey?: string; // default inviteModal.title
  subtitleKey?: string; // default inviteModal.subtitle
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

export default function InviteEmployeeModal({
  open,
  onClose,
  onSubmit,
  locations,
  defaultLocationId = null,
  titleKey = "inviteModal.title",
  subtitleKey = "inviteModal.subtitle",
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [locationId, setLocationId] = useState<string>(defaultLocationId ?? "");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const hasLocations = Boolean(locations && locations.length);

  const canSubmit = useMemo(() => {
    const e = safeText(email);
    if (!e || !isEmail(e)) return false;
    if (hasLocations && !safeText(locationId)) return false;
    return !submitting;
  }, [email, locationId, hasLocations, submitting]);

  // reset form each time opened
  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
    setName("");
    setEmail("");
    setDepartment("");
    setLocationId(defaultLocationId ?? "");
    setNote("");

    // focus email for speed
    const id = setTimeout(() => emailRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open, defaultLocationId]);

  // ESC to close
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setError(null);

    const e = safeText(email).toLowerCase();
    if (!e || !isEmail(e)) {
      setError(t("inviteModal.fields.email.error"));
      return;
    }

    if (hasLocations && !safeText(locationId)) {
      setError(t("inviteModal.fields.location.error"));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: safeText(name) || null,
        email: e,
        department: safeText(department) || null,
        locationId: safeText(locationId) || null,
        note: safeText(note) || null,
      });
      onClose();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? t("system.errors.generic")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={t(titleKey)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="lp-glass-overlay absolute inset-0" onClick={onClose} aria-label="Lukk" />
      <div
        ref={dialogRef}
        className="lp-glass-panel relative w-full max-w-lg rounded-card p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t(titleKey)}</h2>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{t(subtitleKey)}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            aria-label={t("inviteModal.buttons.cancel")}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="mt-5 grid gap-3">
          <div>
            <label className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
              {t("inviteModal.fields.name.label")}
            </label>
            <input
              className="lp-input mt-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("inviteModal.fields.name.placeholder")}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
              {t("inviteModal.fields.email.label")}
            </label>
            <input
              ref={emailRef}
              className="lp-input mt-1 w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("inviteModal.fields.email.placeholder")}
              autoComplete="email"
              inputMode="email"
            />
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{t("inviteModal.fields.email.help")}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
              {t("inviteModal.fields.department.label")}
            </label>
            <input
              className="lp-input mt-1 w-full"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={t("inviteModal.fields.department.placeholder")}
              autoComplete="organization"
            />
          </div>

          {hasLocations ? (
            <div>
              <label className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                {t("inviteModal.fields.location.label")}
              </label>
              <select
                className="lp-input mt-1 w-full"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">{t("inviteModal.fields.location.placeholder")}</option>
                {(locations ?? []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
              {t("inviteModal.fields.note.label")}
            </label>
            <textarea
              className="lp-input mt-1 w-full min-h-[88px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("inviteModal.fields.note.placeholder")}
            />
          </div>

          {error ? (
            <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-3 text-sm text-red-700 ring-1 ring-[rgb(var(--lp-border))]">
              {error}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            onClick={onClose}
            disabled={submitting}
          >
            {t("inviteModal.buttons.cancel")}
          </button>

          <button
            type="button"
            className="lp-btn"
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting ? t("system.micro.loading") : t("inviteModal.buttons.submit")}
          </button>
        </div>

        {/* Footer note */}
        <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">
          {t("companyBox.text")}
        </div>
      </div>
    </div>
  );
}
