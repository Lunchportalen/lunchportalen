"use client";

import * as React from "react";

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
};

type ToastCtx = {
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastCtx | null>(null);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

const KIND_STYLE: Record<ToastKind, string> = {
  default: "bg-[color:var(--lp-surface)] text-[color:var(--lp-fg)] border-[color:var(--lp-border)]",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  error: "bg-red-50 text-red-900 border-red-200",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
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
      <div className="fixed bottom-4 right-4 z-[80] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-2xl border p-4 shadow-[var(--lp-shadow-sm)]",
              "transition-[transform,opacity] duration-200 [transition-timing-function:var(--lp-ease)]",
              "hover:-translate-y-[1px]",
              KIND_STYLE[t.kind]
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
                <div className={cn("text-sm", t.title ? "mt-0.5" : "")}>{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="ml-auto rounded-xl px-2 py-1 text-xs opacity-70 hover:bg-black/5 hover:opacity-100"
              >
                Lukk
              </button>
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
