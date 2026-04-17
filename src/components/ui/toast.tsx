"use client";

// STATUS: KEEP — canonical path: src/components (see tsconfig @/components/*)

import * as React from "react";
import {
  getToastSemanticClass,
  getToastVariantClass,
  type FeedbackVariant,
} from "@/lib/ui/feedbackVariants";
import { motionClasses } from "@/lib/ui/motionTokens";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type ToastKind = "default" | "success" | "error" | "warning";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  durationMs?: number; // default 3500
  /** Optional primary action (e.g. undo) — additive UX hook */
  action?: { label: string; onClick: () => void };
};

type ToastCtx = {
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastCtx | null>(null);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/** Fallback when variant not used: preserve original kind-based styling */
const KIND_STYLE_LEGACY: Record<ToastKind, string> = {
  default: "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)] border-[color:var(--lp-border)]",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  error: "bg-red-50 text-red-900 border-red-200",
};

export function ToastProvider({
  children,
  variant,
}: {
  children: React.ReactNode;
  /** Visual variant (lp-toast-*); omit for legacy kind-based styling */
  variant?: FeedbackVariant;
}) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = uid();
      const duration = t.durationMs ?? 3500;

      const item: ToastItem = { id, ...t };
      setItems((prev) => [item, ...prev].slice(0, 5));

      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const ctx = React.useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* viewport */}
      <div className="fixed bottom-4 right-4 z-[80] flex w-[min(420px,calc(100%-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              motionClasses.toast,
              "p-4 text-[color:var(--lp-fg)] hover:-translate-y-[1px]",
              variant
                ? cn(getToastVariantClass(variant), getToastSemanticClass(t.kind as "success" | "error" | "warning" | "info" | "default"))
                : cn("rounded-2xl border shadow-[var(--lp-shadow-sm)]", KIND_STYLE_LEGACY[t.kind])
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                {t.title ? <div className="font-heading text-sm font-semibold">{t.title}</div> : null}
                <div className={cn("font-body text-sm", t.title ? "mt-0.5" : "")}>{t.message}</div>
              </div>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                {t.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        t.action?.onClick();
                      } finally {
                        dismiss(t.id);
                      }
                    }}
                    className="lp-motion-btn rounded-xl px-2.5 py-1 text-xs font-medium text-[color:var(--lp-fg)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--lp-ring),0.25)] active:scale-[0.98]"
                  >
                    {t.action.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="lp-motion-btn rounded-xl px-2 py-1 text-xs opacity-70 hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--lp-ring),0.25)] active:scale-[0.98]"
                >
                  Lukk
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return ctx;
}
