"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Variant = "delete" | "deactivate";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant: Variant;
  expectedConfirmation?: string;
  loading?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ConfirmDestructiveDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  variant,
  expectedConfirmation,
  loading = false,
}: Props) {
  const [confirmation, setConfirmation] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const needsTypedConfirmation = variant === "delete" && Boolean(expectedConfirmation);
  const confirmed = useMemo(() => {
    if (!needsTypedConfirmation) return true;
    return confirmation.trim() === expectedConfirmation;
  }, [confirmation, expectedConfirmation, needsTypedConfirmation]);

  useEffect(() => {
    if (!open) {
      setConfirmation("");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => {
      if (needsTypedConfirmation) inputRef.current?.focus();
      else panelRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [loading, needsTypedConfirmation, onCancel, open]);

  if (!open) return null;

  const confirmClass =
    variant === "delete"
      ? "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-200"
      : "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-200";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Lukk"
        className="absolute inset-0 cursor-default bg-black/35"
        disabled={loading}
        onClick={onCancel}
      />

      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="destructive-dialog-title"
        aria-describedby="destructive-dialog-description"
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 text-neutral-950 shadow-2xl outline-none"
      >
        <div className="space-y-2">
          <div id="destructive-dialog-title" className="text-lg font-semibold">
            {title}
          </div>
          <div id="destructive-dialog-description" className="text-sm leading-6 text-neutral-600">
            {description}
          </div>
        </div>

        {needsTypedConfirmation ? (
          <div className="mt-5">
            <label htmlFor="destructive-confirm-email" className="block text-sm font-medium text-neutral-800">
              Skriv inn e-postadressen for å bekrefte
            </label>
            <input
              ref={inputRef}
              id="destructive-confirm-email"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100"
              placeholder={expectedConfirmation}
              disabled={loading}
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className={cx(
              "rounded-2xl px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
              confirmClass
            )}
          >
            {loading ? "Jobber..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
