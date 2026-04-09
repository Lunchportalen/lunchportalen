"use client";

/**
 * U96B — Admin-merged Element Type runtime display fra GET /api/backoffice/cms/element-type-runtime.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ElementTypeRuntimeMergedPayload } from "@/lib/cms/schema/elementTypeRuntimeMerge";

type Ctx = {
  data: ElementTypeRuntimeMergedPayload | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const ElementTypeRuntimeMergedContext = createContext<Ctx | null>(null);

export function ElementTypeRuntimeMergedProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ElementTypeRuntimeMergedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/cms/element-type-runtime", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: ElementTypeRuntimeMergedPayload };
      if (!res.ok || !j?.ok || !j.data?.merged) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      setData(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste element types (runtime)");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refetch]);

  const value = useMemo<Ctx>(() => ({ data, loading, error, refetch }), [data, loading, error, refetch]);

  return (
    <ElementTypeRuntimeMergedContext.Provider value={value}>{children}</ElementTypeRuntimeMergedContext.Provider>
  );
}

export function useElementTypeRuntimeMergedOptional(): Ctx | null {
  return useContext(ElementTypeRuntimeMergedContext);
}
