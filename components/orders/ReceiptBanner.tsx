// components/orders/ReceiptBanner.tsx
// A3.1 — Deterministic receipt/error banner
// - Shows rid always
// - Shows OK / FAIL state
// - Shows retry button ONLY when retryable
// - Optional auto-retry countdown when retryAfterSeconds is provided

"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ReceiptState, ActionErrorState } from "@/lib/orders/useOrderActions";

type ReceiptBannerProps = {
  receipt: ReceiptState | null;
  error: ActionErrorState | null;
  onRetry?: () => void;
  onDismiss?: () => void;
};

function fmtAction(a: ReceiptState["action"]) {
  return a === "UPSERT" ? "Bestilling" : "Avbestilling";
}

function fmtStatus(s: string | null | undefined) {
  if (!s) return "Ukjent";
  const v = String(s).toUpperCase();
  if (v === "CANCELLED" || v === "CANCELED" || v === "CANCELLED") return "Avbestilt";
  if (v === "ACTIVE") return "Registrert";
  return v;
}

export default function ReceiptBanner({ receipt, error, onRetry, onDismiss }: ReceiptBannerProps) {
  const show = !!receipt || !!error;

  const retryable = !!error?.retryable && typeof onRetry === "function";
  const retryAfter = error?.retryAfterSeconds ?? null;

  const [countdown, setCountdown] = useState<number | null>(null);

  // start countdown when retryAfter is present
  useEffect(() => {
    if (!retryable) {
      setCountdown(null);
      return;
    }
    if (!retryAfter || retryAfter <= 0) {
      setCountdown(null);
      return;
    }
    setCountdown(retryAfter);

    const t = setInterval(() => {
      setCountdown((c) => {
        if (c == null) return null;
        if (c <= 1) return 0;
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [retryable, retryAfter]);

  const canRetryNow = useMemo(() => {
    if (!retryable) return false;
    if (countdown == null) return true;
    return countdown <= 0;
  }, [retryable, countdown]);

  if (!show) return null;

  const rid = receipt?.rid ?? error?.rid ?? "rid_missing";
  const ok = receipt?.ok === true && !error;

  const title = ok
    ? `${fmtAction(receipt!.action)} bekreftet`
    : receipt?.ok === false
      ? `${fmtAction(receipt.action)} feilet`
      : "Handling feilet";

  const subtitle = ok
    ? `Status: ${fmtStatus(receipt?.status)}`
    : error
      ? `${error.code}: ${error.message}`
      : receipt?.message
        ? `${receipt.code ?? "ERROR"}: ${receipt.message}`
        : "Ukjent feil.";

  return (
    <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white shadow-[var(--lp-shadow-soft)]">
      <div className="flex items-start justify-between gap-4 p-4 md:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={[
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
              ].join(" ")}
            >
              {ok ? "OK" : "FEIL"}
            </div>

            {receipt?.date ? (
              <div className="text-xs text-[rgb(var(--lp-muted))]">
                Dato: <span className="font-medium text-[rgb(var(--lp-text))]">{receipt.date}</span>
              </div>
            ) : null}

            {receipt?.orderId ? (
              <div className="text-xs text-[rgb(var(--lp-muted))]">
                OrderId: <span className="font-medium text-[rgb(var(--lp-text))]">{receipt.orderId}</span>
              </div>
            ) : null}
          </div>

          <h3 className="mt-2 text-base font-semibold text-[rgb(var(--lp-text))]">{title}</h3>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{subtitle}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="rounded-lg bg-[rgb(var(--lp-surface-alt))] px-2.5 py-1.5 text-xs text-[rgb(var(--lp-muted))]">
              RID: <span className="font-mono text-[rgb(var(--lp-text))]">{rid}</span>
            </div>

            {receipt?.timestamp ? (
              <div className="rounded-lg bg-[rgb(var(--lp-surface-alt))] px-2.5 py-1.5 text-xs text-[rgb(var(--lp-muted))]">
                Tid: <span className="font-mono text-[rgb(var(--lp-text))]">{receipt.timestamp}</span>
              </div>
            ) : null}

            {error?.retryable ? (
              <div className="rounded-lg bg-[rgb(var(--lp-surface-alt))] px-2.5 py-1.5 text-xs text-[rgb(var(--lp-muted))]">
                Retry:{" "}
                <span className="font-medium text-[rgb(var(--lp-text))]">
                  {countdown == null ? "klar" : countdown <= 0 ? "klar" : `om ${countdown}s`}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {retryable ? (
            <button
              type="button"
              onClick={() => {
                if (canRetryNow) onRetry?.();
              }}
              disabled={!canRetryNow}
              className={[
                "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium",
                "border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-text))]",
                "shadow-[var(--lp-shadow-soft)] hover:shadow-[var(--lp-shadow-soft)]",
                !canRetryNow ? "opacity-60 cursor-not-allowed" : "hover:bg-[rgb(var(--lp-surface-alt))]",
              ].join(" ")}
            >
              Prøv igjen
            </button>
          ) : null}

          {typeof onDismiss === "function" ? (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
            >
              Lukk
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
