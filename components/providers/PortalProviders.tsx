// components/providers/PortalProviders.tsx
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

import { OrderActionsProvider } from "@/lib/orders/OrderActionsProvider";
import OrderToastBridge from "@/components/toast/OrderToastBridge";

/**
 * =========================================================
 * PortalProviders (KOMPLETT / FASIT)
 * =========================================================
 * Global client-side providers for everything inside the portal.
 *
 * Included:
 * - ThemeProvider (light/dark/system, minimal, deterministic)
 * - FeatureFlagsProvider (static flags, stable ref)
 * - ToastProvider (global, mobile-safe)
 * - OrderActionsProvider (A4 high-traffic store)
 * - OrderToastBridge (A5 receipt/error → toast, rid-dedupe)
 *
 * Notes:
 * - No route-dependent state here.
 * - All provider values are stable (refs/memo).
 * - StrictMode-safe (no double-toasts).
 * =========================================================
 */

/* =========================================================
   THEME (light/dark/system) — minimal, deterministic
========================================================= */

type ThemeMode = "system" | "light" | "dark";

type ThemeCtxValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolvedTheme: "light" | "dark";
};

const ThemeCtx = createContext<ThemeCtxValue | null>(null);

function getResolvedTheme(t: ThemeMode): "light" | "dark" {
  if (t === "light" || t === "dark") return t;
  try {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    return prefersDark ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyThemeToDom(t: ThemeMode) {
  try {
    const root = document.documentElement;
    const resolved = getResolvedTheme(t);
    root.dataset.theme = t;
    root.dataset.resolvedTheme = resolved;
  } catch {
    // no-op
  }
}

function readThemeFromStorage(): ThemeMode {
  try {
    const v = localStorage.getItem("lp_theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // no-op
  }
  return "system";
}

function writeThemeToStorage(t: ThemeMode) {
  try {
    localStorage.setItem("lp_theme", t);
  } catch {
    // no-op
  }
}

function ThemeProvider({ children }: { children: ReactNode }) {
  type ThemeState = { theme: ThemeMode };

  const stateRef = useRef<ThemeState>({ theme: "system" });
  const listenersRef = useRef(new Set<() => void>());

  const getSnapshot = useCallback(() => stateRef.current, []);
  const subscribe = useCallback((l: () => void) => {
    listenersRef.current.add(l);
    return () => listenersRef.current.delete(l);
  }, []);

  const emit = useCallback(() => {
    listenersRef.current.forEach((l) => l());
  }, []);

  // Init once on client (apply early to minimize shift)
  if (typeof window !== "undefined" && stateRef.current.theme === "system") {
    const stored = readThemeFromStorage();
    stateRef.current = { theme: stored };
    applyThemeToDom(stored);
  }

  // React to OS theme change when theme == system
  if (typeof window !== "undefined") {
    try {
      const w = window as any;
      const guardKey = "__lp_theme_mql_bound__";
      if (!w[guardKey]) {
        w[guardKey] = true;
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => {
          if (stateRef.current.theme === "system") {
            applyThemeToDom("system");
            emit();
          }
        };
        if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange);
        else (mql as any).addListener?.(onChange);
      }
    } catch {
      // no-op
    }
  }

  const setTheme = useCallback(
    (t: ThemeMode) => {
      stateRef.current = { theme: t };
      writeThemeToStorage(t);
      applyThemeToDom(t);
      emit();
    },
    [emit]
  );

  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const resolvedTheme =
    typeof window !== "undefined" ? getResolvedTheme(snap.theme) : "light";

  const value = useMemo<ThemeCtxValue>(
    () => ({ theme: snap.theme, setTheme, resolvedTheme }),
    [snap.theme, setTheme, resolvedTheme]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme må brukes innenfor <ThemeProvider />");
  return v;
}

/* =========================================================
   FEATURE FLAGS — stable, single source
========================================================= */

export type FeatureFlags = Record<string, boolean>;

type FeatureFlagsCtxValue = {
  flags: FeatureFlags;
  isOn: (key: string) => boolean;
};

const FeatureFlagsCtx = createContext<FeatureFlagsCtxValue | null>(null);

function FeatureFlagsProvider({
  children,
  flags,
}: {
  children: ReactNode;
  flags: FeatureFlags;
}) {
  const stableFlags = useMemo(() => flags, [flags]);
  const isOn = useCallback((key: string) => Boolean(stableFlags[key]), [stableFlags]);

  const value = useMemo<FeatureFlagsCtxValue>(
    () => ({ flags: stableFlags, isOn }),
    [stableFlags, isOn]
  );

  return <FeatureFlagsCtx.Provider value={value}>{children}</FeatureFlagsCtx.Provider>;
}

export function useFeatureFlags() {
  const v = useContext(FeatureFlagsCtx);
  if (!v) throw new Error("useFeatureFlags må brukes innenfor <FeatureFlagsProvider />");
  return v;
}

/* =========================================================
   TOAST — global provider + viewport (mobile safe)
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

type ToastApi = {
  push: (t: Omit<ToastItem, "id" | "createdAt"> & { id?: string; createdAt?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

function genId() {
  return `t_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function ToastProvider({ children }: { children: ReactNode }) {
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

      // Dedupe: same kind+message within 1.2s
      const now = Date.now();
      const items = stateRef.current.items;
      const recentDup = items.some(
        (x) => x.kind === item.kind && x.message === item.message && now - x.createdAt < 1200
      );
      if (recentDup) return id;

      stateRef.current = { items: [...items, item].slice(-4) }; // keep last 4
      emit();

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
            className="pointer-events-auto rounded-2xl border border-[rgb(var(--lp-border))] bg-white/95 p-3 shadow-[var(--lp-shadow-soft)] backdrop-blur"
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

/* =========================================================
   PORTAL PROVIDERS — final composition
========================================================= */

type PortalProvidersProps = {
  children: ReactNode;
};

export default function PortalProviders({ children }: PortalProvidersProps) {
  const orderOptions = useMemo(
    () => ({
      maxRetries: 2,
      baseDelayMs: 250,
    }),
    []
  );

  const featureFlags = useMemo<FeatureFlags>(
    () => ({
      receiptBanner: true,
      orderRetry: true,
      toastBridgeA5: true, // ✅ A5 aktiv
      weekA4Writes: true,
    }),
    []
  );

  return (
    <ThemeProvider>
      <FeatureFlagsProvider flags={featureFlags}>
        <ToastProvider>
          <OrderActionsProvider options={orderOptions}>
            {/* A5: receipt/error → toast (rid-dedupe, StrictMode-safe) */}
            <OrderToastBridge />
            {children}
          </OrderActionsProvider>
        </ToastProvider>
      </FeatureFlagsProvider>
    </ThemeProvider>
  );
}
