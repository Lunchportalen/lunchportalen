/**
 * U30X — Én klassifisering for når GET /api/backoffice/content/tree skal returnere 200 + ærlig degradert
 * virtuelt tre (ikke 500), f.eks. schema cache / manglende kolonne utover kjente fallbacks.
 */

import { isMissingColumnError } from "@/lib/cms/contentTreePageKey";

function serializeError(e: unknown): string {
  if (e == null) return "";
  if (e instanceof Error) return e.message || e.name || "";
  if (typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function getErrorCode(e: unknown): string | null {
  return typeof (e as { code?: unknown })?.code === "string"
    ? ((e as { code: string }).code ?? null)
    : null;
}

function getErrorMessage(e: unknown): string {
  return serializeError(e).toLowerCase();
}

export type TreeRouteSchemaDegradedReason =
  | "PAGE_KEY_COLUMN_MISSING"
  | "TREE_COLUMNS_MISSING"
  | "TABLE_OR_CONTENT_PAGES_UNAVAILABLE"
  | "SCHEMA_OR_CACHE_UNAVAILABLE";

export type TreeRouteSchemaIssue = {
  reason: TreeRouteSchemaDegradedReason;
  operatorMessage: string;
  operatorAction: string;
  schemaHints: {
    detail: string;
    code: string | null;
    pageKeyColumnMissing?: true;
    pageKeyInferredFromSlug?: true;
    treeColumnsMissing?: true;
    tableMissing?: true;
    queryFailed?: true;
    missingColumns?: string[];
  };
};

export function isTreeRouteMissingTableError(e: unknown): boolean {
  const code = getErrorCode(e);
  const msg = getErrorMessage(e);

  if (msg.includes("column") && msg.includes("does not exist")) return false;

  return (
    code === "42P01" ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes('relation "content_pages"') ||
    msg.includes("table 'public.content_pages'") ||
    msg.includes("could not find the table 'public.content_pages'")
  );
}

function getMissingTreeColumns(e: unknown): string[] {
  return ["tree_parent_id", "tree_root_key", "tree_sort_order"].filter((column) =>
    isMissingColumnError(e, column),
  );
}

/**
 * True når feilen sannsynligvis er migrasjon/schema/cache — trygg å degradere til tomt side-tre
 * med virtuelle røtter (Hjem, overlays, …) i stedet for 500.
 * Ikke bruk for auth/RLS — de håndteres før catch eller gir 403.
 */
export function isTreeRouteDegradableSchemaError(e: unknown): boolean {
  const code = getErrorCode(e) ?? "";
  const msg = getErrorMessage(e);
  if (code === "42703") return true;
  if (code === "PGRST204") return true;
  if (code === "PGRST116") return false;
  if (msg.includes("schema cache")) return true;
  if (msg.includes("could not find the column")) return true;
  if (msg.includes("undefined column")) return true;
  if (msg.includes("column") && msg.includes("does not exist")) return true;
  return false;
}

export function resolveTreeRouteSchemaIssue(e: unknown): TreeRouteSchemaIssue | null {
  const detail = serializeError(e);
  const code = getErrorCode(e);

  if (isMissingColumnError(e, "page_key")) {
    return {
      reason: "PAGE_KEY_COLUMN_MISSING",
      operatorMessage:
        "Content-treet bruker slug-basert reserve for kind fordi content_pages.page_key mangler i dette miljøet.",
      operatorAction:
        "Kjør migrasjonen som legger til page_key og refresh schema/cache for å få stabile kind-bindinger tilbake.",
      schemaHints: {
        pageKeyColumnMissing: true,
        pageKeyInferredFromSlug: true,
        missingColumns: ["page_key"],
        detail,
        code,
      },
    };
  }

  const missingTreeColumns = getMissingTreeColumns(e);
  if (missingTreeColumns.length > 0) {
    const missingLabel = missingTreeColumns.join(", ");
    return {
      reason: "TREE_COLUMNS_MISSING",
      operatorMessage:
        `Content-treet er degradert fordi ${missingLabel} mangler i content_pages. Viser trygg reservevisning uten full trestruktur.`,
      operatorAction:
        `Kjør migrasjonene som legger til ${missingLabel} og refresh schema/cache før opprett, flytt og omdøp åpnes igjen.`,
      schemaHints: {
        treeColumnsMissing: true,
        missingColumns: missingTreeColumns,
        detail,
        code,
      },
    };
  }

  if (isTreeRouteMissingTableError(e)) {
    return {
      reason: "TABLE_OR_CONTENT_PAGES_UNAVAILABLE",
      operatorMessage:
        "Content-treet er degradert fordi content_pages mangler eller er utilgjengelig. Viser bare virtuelle røtter.",
      operatorAction:
        "Kjør migrasjonene som oppretter content_pages og refresh schema/cache før du forsøker nye mutasjoner.",
      schemaHints: {
        tableMissing: true,
        detail,
        code,
      },
    };
  }

  if (isTreeRouteDegradableSchemaError(e)) {
    return {
      reason: "SCHEMA_OR_CACHE_UNAVAILABLE",
      operatorMessage:
        "Content-treet er degradert fordi schema/cache hindret full lesing av content_pages. Viser virtuelle røtter til migrasjonene er på plass.",
      operatorAction:
        "Oppdater Supabase schema/cache eller kjør manglende migrasjoner, og last deretter treet på nytt.",
      schemaHints: {
        queryFailed: true,
        detail,
        code,
      },
    };
  }

  return null;
}
