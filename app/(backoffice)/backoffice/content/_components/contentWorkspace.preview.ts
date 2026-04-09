/**
 * Preview wiring shared by ContentWorkspace (draft query, backoffice preview URLs).
 * U98 — editor locale (nb | en) drives variant-rad.
 */

import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import type { CmsStorageLocale } from "@/lib/cms/schema/languageDefinitions";

export const CMS_EDITOR_LOCALE_DEFAULT: CmsStorageLocale = "nb";

export function normalizeEditorLocale(raw: string | null | undefined): CmsStorageLocale {
  const t = String(raw ?? "").trim().toLowerCase();
  return t === "en" ? "en" : "nb";
}

/** Query string for CMS editor / API detail fetch (draft variant). */
export function cmsPageDetailQueryString(locale: string | null | undefined = CMS_EDITOR_LOCALE_DEFAULT): string {
  return new URLSearchParams({
    locale: normalizeEditorLocale(locale),
    environment: CMS_DRAFT_ENVIRONMENT,
  }).toString();
}

/** Absolute path to in-app draft preview for a page id (same renderer stack as public). */
export function backofficePreviewPath(pageId: string): string {
  const id = String(pageId ?? "").trim();
  return `/backoffice/preview/${encodeURIComponent(id)}`;
}
