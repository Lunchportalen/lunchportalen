import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchPageVersionSnapshot,
  insertPageVersionRow,
  type PageVersionDataV1,
} from "@/lib/backoffice/content/pageVersionsRepo";
import { opsLog } from "@/lib/ops/log";

import { replaceFirstTextInBody } from "./blocksText";

/**
 * 1) Snapshot current preview (reversible baseline in page_versions).
 * 2) Update preview variant body only.
 */
export async function updatePreviewVariantBody(
  admin: SupabaseClient,
  params: {
    pageId: string;
    locale: string;
    newBody: unknown;
    createdBy: string | null;
    label: string;
    action: string;
    rid: string;
  }
): Promise<{ ok: true; versionNumber: number } | { ok: false; error: string }> {
  const env = "preview";
  const before = await fetchPageVersionSnapshot(admin, params.pageId, params.locale, env);
  if (!before) {
    return { ok: false, error: "page_not_found" };
  }

  try {
    const { version_number } = await insertPageVersionRow(admin, {
      pageId: params.pageId,
      locale: params.locale,
      environment: env,
      data: before,
      createdBy: params.createdBy,
      label: params.label,
      action: params.action,
    });

    const { error } = await admin
      .from("content_page_variants")
      .update({ body: params.newBody as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq("page_id", params.pageId)
      .eq("locale", params.locale)
      .eq("environment", env);

    if (error) {
      opsLog("growth_preview_body_update_failed", { rid: params.rid, message: error.message });
      return { ok: false, error: error.message };
    }

    return { ok: true, versionNumber: version_number };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Thin alias: version snapshot + preview body text replace (same as apply flow).
 */
export async function updateContent(
  admin: SupabaseClient,
  pageId: string,
  newText: string,
  opts: {
    locale: string;
    createdBy: string | null;
    rid: string;
  }
): Promise<{ ok: true; versionNumber: number } | { ok: false; error: string }> {
  return applyImprovedTextToPreviewBody(admin, {
    pageId,
    locale: opts.locale,
    improvedText: newText,
    createdBy: opts.createdBy,
    rid: opts.rid,
  });
}

export async function applyImprovedTextToPreviewBody(
  admin: SupabaseClient,
  params: {
    pageId: string;
    locale: string;
    improvedText: string;
    createdBy: string | null;
    rid: string;
  }
): Promise<{ ok: true; versionNumber: number } | { ok: false; error: string }> {
  const env = "preview";
  const snap = await fetchPageVersionSnapshot(admin, params.pageId, params.locale, env);
  if (!snap) {
    return { ok: false, error: "page_not_found" };
  }
  const nextBody = replaceFirstTextInBody(snap.body, params.improvedText);
  return updatePreviewVariantBody(admin, {
    pageId: params.pageId,
    locale: params.locale,
    newBody: nextBody,
    createdBy: params.createdBy,
    label: "Growth experiment",
    action: "growth_apply_preview",
    rid: params.rid,
  });
}
