/**
 * U22 — Collection view / bulk (kontrollplan-typer). Ingen ny collection-motor.
 * Bulk-mutasjon krever eksplisitt backend — ikke definert her.
 */

export type MediaCollectionStatusFilter = "all" | "ready" | "proposed" | "failed";

export const MEDIA_COLLECTION_STATUS_OPTIONS: readonly { value: MediaCollectionStatusFilter; label: string }[] = [
  { value: "all", label: "Alle status" },
  { value: "ready", label: "Ready" },
  { value: "proposed", label: "Foreslått" },
  { value: "failed", label: "Feilet" },
] as const;

/** Tekstlig merking for trygg bulk (kun klient-side, ingen API). */
export const SAFE_BULK_COPY_MEDIA_URLS = "Kopier URLer for valgte (trygg bulk — kun utklippstavle)";
