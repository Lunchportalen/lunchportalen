// lib/theme/ThemeProvider.tsx
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
   ThemeProvider (A7)
   - Modes: system | light | dark
   - Writes: <html data-theme="..."> and data-resolved-theme="..."
   - External-store pattern (no portal-wide rerenders except theme consumers)
   - Applies immediately to DOM (minimize layout shift)
========================================================= */

export type ThemeMode = "system" | "light" | "dark";

type ThemeState = { theme: ThemeMode };

type ThemeCtxValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolvedTheme: "light" | "dark";
};

const ThemeCtx = createContext<ThemeCtxValue | null>(null);

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function readThemeFromStorage(): ThemeMode {
  try {
    const v = safeStr(localStorage.getItem("lp_theme"));
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  // External-store (stable, no context churn)
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

  // Init once on client (apply early)
  if (typeof window !== "undefined" && stateRef.current.theme === "system") {
    const stored = readThemeFromStorage();
    stateRef.current = { theme: stored };
    applyThemeToDom(stored);
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

  // Keep system theme reactive when user changes OS setting
  // (only matters when theme === "system")
  if (typeof window !== "undefined") {
    try {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      // Attach once
      // We use a ref guard to avoid duplicates across rerenders
      // (React StrictMode will mount/unmount; this provider stays in tree normally)
      const guardKey = "__lp_theme_mql_bound__";
      const w = window as any;
      if (!w[guardKey]) {
        w[guardKey] = true;
        const onChange = () => {
          const current = stateRef.current.theme;
          if (current === "system") {
            applyThemeToDom("system");
            emit();
          }
        };
        // modern + fallback
        if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange);
        else (mql as any).addListener?.(onChange);
      }
    } catch {
      // no-op
    }
  }

  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const resolved = typeof window !== "undefined" ? getResolvedTheme(snap.theme) : "light";

  const value = useMemo<ThemeCtxValue>(
    () => ({
      theme: snap.theme,
      setTheme,
      resolvedTheme: resolved,
    }),
    [snap.theme, setTheme, resolved]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme må brukes innenfor <ThemeProvider />");
  return v;
}
