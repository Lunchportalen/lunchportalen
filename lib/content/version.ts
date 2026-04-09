import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchPageVersionSnapshot,
  insertPageVersionRow,
  recordPageContentVersion,
  listPageVersions,
  type PageVersionDataV1,
  PAGE_VERSION_DATA_SCHEMA,
} from "@/lib/backoffice/content/pageVersionsRepo";

export {
  fetchPageVersionSnapshot,
  insertPageVersionRow,
  recordPageContentVersion,
  listPageVersions,
  type PageVersionDataV1,
  PAGE_VERSION_DATA_SCHEMA,
};

/**
 * Named snapshot insert — same storage as `insertPageVersionRow` / `page_versions`.
 */
export async function createVersion(
  admin: SupabaseClient,
  pageId: string,
  data: PageVersionDataV1,
  options?: {
    locale?: string;
    environment?: string;
    createdBy?: string | null;
    label?: string;
    action?: string;
  }
): Promise<{ id: string; version_number: number }> {
  return insertPageVersionRow(admin, {
    pageId,
    locale: options?.locale ?? "nb",
    environment: options?.environment ?? "preview",
    data,
    createdBy: options?.createdBy ?? null,
    label: options?.label ?? "createVersion",
    action: options?.action ?? "createVersion",
  });
}
