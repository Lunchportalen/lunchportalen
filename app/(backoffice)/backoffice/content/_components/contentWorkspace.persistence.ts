/**
 * Persist layer for ContentWorkspace: PATCH transport + save payload shape.
 * Save/status/publish orchestration lives in `useContentWorkspacePersistence.ts`.
 */

"use client";

import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import { LP_CMS_CLIENT_HEADER, LP_CMS_CLIENT_CONTENT_WORKSPACE } from "@/lib/cms/cmsClientHeaders";
import { makeRidClient } from "./contentWorkspace.helpers";
import { normalizeEditorLocale } from "./contentWorkspace.preview";
import type { PageStatus } from "./contentWorkspace.types";

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && (err.message === "Failed to fetch" || err.message === "Load failed")) return true;
  return false;
}

/** Single HTTP entry for PATCH `/api/backoffice/content/pages/[id]` (draft variant + CMS client header). */
export async function fetchPatchContentPage(
  pageId: string,
  partial: Record<string, unknown>,
  options?: { signal?: AbortSignal; editorLocale?: string | null },
): Promise<Response> {
  return fetch(`/api/backoffice/content/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      [LP_CMS_CLIENT_HEADER]: LP_CMS_CLIENT_CONTENT_WORKSPACE,
    },
    body: JSON.stringify({
      locale: normalizeEditorLocale(options?.editorLocale),
      environment: CMS_DRAFT_ENVIRONMENT,
      ...partial,
    }),
    signal: options?.signal,
  });
}

/** Body for “save draft” — same fields as previous inline object in performSave. */
export function buildDraftSavePayload(args: {
  title: string;
  slug: string;
  bodyForSave: unknown;
  lastServerUpdatedAt: string | null;
  /** U98 — stamps variant layer at save time (ikke i dirty-snapshot). */
  envelopeMeta?: { editorLocale: string; pageStatus: PageStatus };
}): Record<string, unknown> {
  let bodyPayload: unknown = args.bodyForSave;
  if (
    args.envelopeMeta &&
    bodyPayload &&
    typeof bodyPayload === "object" &&
    !Array.isArray(bodyPayload) &&
    "documentType" in bodyPayload
  ) {
    const o = { ...(bodyPayload as Record<string, unknown>) };
    o.cmsSaveStamp = {
      at: new Date().toISOString(),
      locale: normalizeEditorLocale(args.envelopeMeta.editorLocale),
    };
    o.cmsVariantPublish = {
      state: args.envelopeMeta.pageStatus === "published" ? "published" : "draft",
      updatedAt: new Date().toISOString(),
    };
    bodyPayload = o;
  }
  const body: Record<string, unknown> = {
    title: args.title,
    slug: args.slug,
    body: bodyPayload,
    rid: makeRidClient(),
  };
  if (args.lastServerUpdatedAt) body.updated_at = args.lastServerUpdatedAt;
  return body;
}
