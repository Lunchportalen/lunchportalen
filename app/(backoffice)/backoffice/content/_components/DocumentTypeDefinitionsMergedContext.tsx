"use client";

/**
 * U96 — Admin-merged Document Type definitions fra GET /api/backoffice/cms/document-type-definitions.
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
import type { DocumentTypeDefinitionsMergedPayload } from "@/lib/cms/schema/documentTypeDefinitionMerge";

type Ctx = {
  data: DocumentTypeDefinitionsMergedPayload | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const DocumentTypeDefinitionsMergedContext = createContext<Ctx | null>(null);

export function DocumentTypeDefinitionsMergedProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DocumentTypeDefinitionsMergedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/cms/document-type-definitions", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: DocumentTypeDefinitionsMergedPayload };
      if (!res.ok || !j?.ok || !j.data?.merged || !j.data?.mergedCore) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      setData(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste document types");
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
    <DocumentTypeDefinitionsMergedContext.Provider value={value}>{children}</DocumentTypeDefinitionsMergedContext.Provider>
  );
}

export function useDocumentTypeDefinitionsMergedOptional(): Ctx | null {
  return useContext(DocumentTypeDefinitionsMergedContext);
}
