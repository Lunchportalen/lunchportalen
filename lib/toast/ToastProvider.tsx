// lib/toast/ToastProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/* =========================================================
   Minimal global toast store (A6)
   - Mobile-safe viewport
   - Dedupe (kind+message within 1.2s)
   - No layout shift
========================================================= */

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  createdAt: number;
  ttlMs?: number;
};

type ToastStoreState = { items: ToastItem[] };

export type ToastApi = {
  push: (t: Omit<ToastItem, "id" | "createdAt"> & { id?: string; createdAt?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

function genId() {
  return `t_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<ToastStoreState>({ items: [] });
  const listenersRef = useRef(new Set<() => void>());

  const getSnapshot = useCallback(() => stateRef.current, []);
  const subscribe = useCallback((l: () => void) => {
    listenersRef.current.add(l);
    return () => listenersRef.current.delete(l);
  }, []);

  const emit = useCallback(() => {
    listenersRef.current.forEach((l) => l());
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const next = stateRef.current.items.filter((x) => x.id !== id);
      if (next.length === stateRef.current.items.length) return;
      stateRef.current = { items: next };
      emit();
    },
    [emit]
  );

  const clear = useCallback(() => {
    if (stateRef.current.items.length === 0) return;
    stateRef.current = { items: [] };
    emit();
  }, [emit]);

  const push = useCallback(
    (t: Omit<ToastItem, "id" | "createdAt"> & { id?: string; createdAt?: number }) => {
      const id = t.id ?? genId();
      const createdAt = t.createdAt ?? Date.now();
      const ttlMs = typeof t.ttlMs === "number" ? t.ttlMs : 4500;

      const item: ToastItem = {
        id,
        kind: t.kind,
        title: t.title,
        message: t.message,
        createdAt,
        ttlMs,
      };

      const now = Date.now();
      const items = stateRef.current.items;

      // Dedupe: same kind+message within 1.2s
      const recentDup = items.some(
        (x) => x.kind === item.kind && x.message === item.message && now - x.createdAt < 1200
      );
      if (recentDup) return id;

      stateRef.current = { items: [...items, item].slice(-4) };
      emit();

      // Auto-dismiss
      window.setTimeout(() => dismiss(id), ttlMs);

      return id;
    },
    [dismiss, emit]
  );

  const api = useMemo<ToastApi>(() => ({ push, dismiss, clear }), [push, dismiss, clear]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport subscribe={subscribe} getSnapshot={getSnapshot} dismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToast må brukes innenfor <ToastProvider />");
  return v;
}

function ToastViewport({
  subscribe,
  getSnapshot,
  dismiss,
}: {
  subscribe: (l: () => void) => () => void;
  getSnapshot: () => ToastStoreState;
  dismiss: (id: string) => void;
}) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const items = snap.items;

  if (!items.length) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-3 left-0 right-0 z-[70] mx-auto w-full max-w-[720px] px-3"
    >
      <div className="flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto lp-glass-surface rounded-card p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {t.title ??
                    (t.kind === "success" ? "OK" : t.kind === "error" ? "Feil" : "Info")}
                </div>
                <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{t.message}</div>
              </div>

              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="lp-btn lp-btn-ghost !px-3 !py-2"
                aria-label="Lukk"
              >
                Lukk
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
