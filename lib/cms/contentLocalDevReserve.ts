import { serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import type { ContentTreeRootKey } from "@/lib/cms/contentTreeRoots";
import { isCmsReserveModeEnabled } from "@/lib/localRuntime/runtime";

export const LOCAL_DEV_CONTENT_RESERVE_FLAG = "LOCAL_DEV_CONTENT_RESERVE";

export type LocalDevReserveContentPage = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  page_key: string | null;
  tree_parent_id: string | null;
  tree_root_key: ContentTreeRootKey | null;
  tree_sort_order: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  body: unknown;
};

const RESERVE_TIMESTAMP = "2026-04-01T00:00:00.000Z";

function safeTrim(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildReserveBody(title: string, note: string): unknown {
  return serializeBodyEnvelope({
    documentType: "page",
    fields: {
      title,
      note,
      localDevReserve: true,
    },
    blocksBody: {
      version: 1,
      blocks: [],
    },
  });
}

const RESERVE_PAGES: readonly LocalDevReserveContentPage[] = [
  {
    id: "00000000-0000-4000-8000-00000000c001",
    title: "Hjem (lokal reserve)",
    slug: "home",
    status: "draft",
    page_key: "home",
    tree_parent_id: null,
    tree_root_key: "home",
    tree_sort_order: 0,
    created_at: RESERVE_TIMESTAMP,
    updated_at: RESERVE_TIMESTAMP,
    published_at: null,
    body: buildReserveBody(
      "Hjem (lokal reserve)",
      "Denne siden leveres fra lokal reserve fordi den eksterne content-backenden ikke er tilgjengelig i utviklingsmiljoet.",
    ),
  },
  {
    id: "00000000-0000-4000-8000-00000000c002",
    title: "Kampanjeside (lokal reserve)",
    slug: "lokal-kampanje",
    status: "draft",
    page_key: null,
    tree_parent_id: null,
    tree_root_key: "overlays",
    tree_sort_order: 0,
    created_at: RESERVE_TIMESTAMP,
    updated_at: RESERVE_TIMESTAMP,
    published_at: null,
    body: buildReserveBody(
      "Kampanjeside (lokal reserve)",
      "Brukes for a verifisere tree, routing og editor-shell lokalt uten ekstern content-backend.",
    ),
  },
  {
    id: "00000000-0000-4000-8000-00000000c003",
    title: "Header (lokal reserve)",
    slug: "header",
    status: "draft",
    page_key: null,
    tree_parent_id: null,
    tree_root_key: "global",
    tree_sort_order: 0,
    created_at: RESERVE_TIMESTAMP,
    updated_at: RESERVE_TIMESTAMP,
    published_at: null,
    body: buildReserveBody(
      "Header (lokal reserve)",
      "Global reserveflate for a holde editoren apen nar content-backenden er utilgjengelig.",
    ),
  },
  {
    id: "00000000-0000-4000-8000-00000000c004",
    title: "Design tokens (lokal reserve)",
    slug: "design-tokens",
    status: "draft",
    page_key: null,
    tree_parent_id: null,
    tree_root_key: "design",
    tree_sort_order: 0,
    created_at: RESERVE_TIMESTAMP,
    updated_at: RESERVE_TIMESTAMP,
    published_at: null,
    body: buildReserveBody(
      "Design tokens (lokal reserve)",
      "Lokal reserveflate for a verifisere designrelaterte editorstier nar Supabase ikke svarer.",
    ),
  },
] as const;

export function isLocalDevContentReserveEnabled(): boolean {
  return isCmsReserveModeEnabled();
}

export function getLocalDevContentReservePages(): LocalDevReserveContentPage[] {
  return RESERVE_PAGES.map((page) => ({
    ...page,
    body: cloneValue(page.body),
  }));
}

export function getLocalDevContentReservePageById(pageId: string): LocalDevReserveContentPage | null {
  const match = RESERVE_PAGES.find((page) => page.id === pageId);
  if (!match) return null;
  return {
    ...match,
    body: cloneValue(match.body),
  };
}

export function getLocalDevContentReservePageBySlug(slug: string): LocalDevReserveContentPage | null {
  const normalized = safeTrim(slug).toLowerCase();
  if (!normalized) return null;
  const match = RESERVE_PAGES.find((page) => page.slug === normalized);
  if (!match) return null;
  return {
    ...match,
    body: cloneValue(match.body),
  };
}

export function getLocalDevContentReserveHomePage(): LocalDevReserveContentPage {
  return getLocalDevContentReservePages()[0]!;
}

function stringifyError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      record.message,
      record.code,
      record.details,
      record.detail,
      record.hint,
      record.error,
      record.reason,
    ]
      .map((value) => safeTrim(typeof value === "string" ? value : null))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error ?? "");
  }
}

export function isContentBackendUnavailableError(error: unknown): boolean {
  const text = stringifyError(error).toLowerCase();
  if (!text) return false;
  return [
    "fetch failed",
    "networkerror",
    "network error",
    "err_name_not_resolved",
    "enotfound",
    "eai_again",
    "getaddrinfo",
    "econnrefused",
    "err_connection_refused",
    "dns",
  ].some((needle) => text.includes(needle));
}
