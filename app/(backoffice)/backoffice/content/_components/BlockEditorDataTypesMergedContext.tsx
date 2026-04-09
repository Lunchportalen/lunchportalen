"use client";

/**
 * U95 — Admin-merged Block Editor Data Types fra GET /api/backoffice/cms/block-editor-data-types.
 * Én runtime-sannhet i editoren sammen med baseline i kode (merge skjer på server).
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
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { BlockEditorDataTypeOverridesFile } from "@/lib/cms/blocks/blockEditorDataTypeMerge";

export type BlockEditorDataTypesMergedPayload = {
  merged: Record<string, BlockEditorDataTypeDefinition>;
  overrides: BlockEditorDataTypeOverridesFile;
};

type Ctx = {
  data: BlockEditorDataTypesMergedPayload | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const BlockEditorDataTypesMergedContext = createContext<Ctx | null>(null);

export function BlockEditorDataTypesMergedProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BlockEditorDataTypesMergedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/cms/block-editor-data-types", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: BlockEditorDataTypesMergedPayload };
      if (!res.ok || !j?.ok || !j.data?.merged) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      setData(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste data types");
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
    <BlockEditorDataTypesMergedContext.Provider value={value}>{children}</BlockEditorDataTypesMergedContext.Provider>
  );
}

export function useBlockEditorDataTypesMerged(): Ctx {
  const ctx = useContext(BlockEditorDataTypesMergedContext);
  if (!ctx) {
    throw new Error("useBlockEditorDataTypesMerged requires BlockEditorDataTypesMergedProvider");
  }
  return ctx;
}

/** Når provider mangler (test/isolasjon), returner null. */
export function useBlockEditorDataTypesMergedOptional(): Ctx | null {
  return useContext(BlockEditorDataTypesMergedContext);
}
