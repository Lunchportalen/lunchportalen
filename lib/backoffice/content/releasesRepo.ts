/**
 * Phase 20: Content releases (batch publish + scheduled). Server-only.
 */

import { recordPageContentVersion } from "./pageVersionsRepo";
import { getWorkflow, resetToDraftAfterPublish } from "./workflowRepo";

export type ReleaseStatus = "draft" | "scheduled" | "executed" | "cancelled";
export type ReleaseRow = {
  id: string;
  name: string;
  environment: string;
  status: ReleaseStatus;
  publish_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type ReleaseItemRow = {
  id: string;
  release_id: string;
  variant_id: string;
  page_id: string;
  locale: string;
  environment: string;
  created_at: string;
};

export async function createRelease(
  supabase: any,
  params: { name: string; environment: "prod" | "staging"; publish_at?: string | null; createdBy?: string | null }
): Promise<ReleaseRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("content_releases")
    .insert({
      name: params.name,
      environment: params.environment,
      status: "draft",
      publish_at: params.publish_at ?? null,
      created_by: params.createdBy ?? null,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ReleaseRow;
}

export async function getRelease(supabase: any, id: string): Promise<ReleaseRow | null> {
  const { data, error } = await supabase.from("content_releases").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ReleaseRow | null;
}

export async function listReleases(
  supabase: any,
  environment: "prod" | "staging"
): Promise<ReleaseRow[]> {
  const { data, error } = await supabase
    .from("content_releases")
    .select("*")
    .eq("environment", environment)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReleaseRow[];
}

export async function addVariantToRelease(
  supabase: any,
  releaseId: string,
  variantId: string,
  pageId: string,
  locale: string,
  environment: string
): Promise<ReleaseItemRow> {
  const { data, error } = await supabase
    .from("content_release_items")
    .insert({
      release_id: releaseId,
      variant_id: variantId,
      page_id: pageId,
      locale,
      environment,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ReleaseItemRow;
}

export async function removeVariantFromRelease(
  supabase: any,
  releaseId: string,
  variantId: string
): Promise<void> {
  const { error } = await supabase
    .from("content_release_items")
    .delete()
    .eq("release_id", releaseId)
    .eq("variant_id", variantId);
  if (error) throw new Error(error.message);
}

export async function listReleaseItems(supabase: any, releaseId: string): Promise<ReleaseItemRow[]> {
  const { data, error } = await supabase
    .from("content_release_items")
    .select("*")
    .eq("release_id", releaseId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ReleaseItemRow[];
}

export async function updateReleaseStatus(
  supabase: any,
  releaseId: string,
  status: ReleaseStatus
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("content_releases")
    .update({ status, updated_at: now })
    .eq("id", releaseId);
  if (error) throw new Error(error.message);
}

/**
 * Copy source variant body into the prod variant for the same page/locale.
 * Ensures public route sees published content after publish.
 */
export async function copyVariantBodyToProd(
  supabase: any,
  pageId: string,
  variantId: string,
  locale: "nb" | "en",
  opts?: { versionCreatedByUserId?: string | null }
): Promise<void> {
  const { data: source, error: fetchErr } = await supabase
    .from("content_page_variants")
    .select("body")
    .eq("id", variantId)
    .eq("page_id", pageId)
    .maybeSingle();
  if (fetchErr) {
    throw new Error(fetchErr.message ?? "Failed to read source variant for publish");
  }
  if (!source) {
    throw new Error("Source variant not found for publish");
  }
  const body = source.body;
  if (body == null) {
    throw new Error("Source variant body is null; cannot publish empty content");
  }
  const now = new Date().toISOString();
  const { data: existing, error: existingErr } = await supabase
    .from("content_page_variants")
    .select("id")
    .eq("page_id", pageId)
    .eq("locale", locale)
    .eq("environment", "prod")
    .maybeSingle();
  if (existingErr) {
    throw new Error(existingErr.message ?? "Failed to read existing prod variant for publish");
  }
  if (existing?.id) {
    const { error: updateErr } = await supabase
      .from("content_page_variants")
      .update({ body, updated_at: now })
      .eq("id", existing.id);
    if (updateErr) {
      throw new Error(updateErr.message ?? "Failed to update prod variant during publish");
    }
  } else {
    const { error: insertErr } = await supabase.from("content_page_variants").insert({
      page_id: pageId,
      locale,
      environment: "prod",
      body,
      updated_at: now,
    });
    if (insertErr) {
      throw new Error(insertErr.message ?? "Failed to create prod variant during publish");
    }
  }

  await recordPageContentVersion(supabase, {
    pageId,
    locale,
    environment: "prod",
    createdBy: opts?.versionCreatedByUserId ?? null,
    label: "Publisert til produksjon",
    action: "publish",
  });
}

export async function publishVariant(
  supabase: any,
  pageId: string,
  variantId: string,
  env: "prod" | "staging",
  locale: "nb" | "en",
  actorEmail: string | null,
  actorUserId: string | null = null
): Promise<void> {
  if (env === "staging") return;
  const workflow = await getWorkflow(supabase, variantId, env, locale);
  if (workflow.state !== "approved") throw new Error("Workflow not approved");
  await copyVariantBodyToProd(supabase, pageId, variantId, locale, { versionCreatedByUserId: actorUserId });
  await resetToDraftAfterPublish(supabase, variantId, pageId, env, locale, actorEmail);
}

export async function executeRelease(
  supabase: any,
  releaseId: string,
  actorEmail: string | null
): Promise<{ count: number }> {
  const release = await getRelease(supabase, releaseId);
  if (!release || release.status !== "scheduled") return { count: 0 };
  const items = await listReleaseItems(supabase, releaseId);
  for (const item of items) {
    await publishVariant(
      supabase,
      item.page_id,
      item.variant_id,
      release.environment as "prod" | "staging",
      item.locale as "nb" | "en",
      actorEmail,
      null
    );
  }
  await updateReleaseStatus(supabase, releaseId, "executed");
  await supabase.from("content_audit_log").insert({
    action: "release_execute",
    metadata: { releaseId, count: items.length },
    actor_email: actorEmail,
  });
  return { count: items.length };
}

export async function getScheduledReleaseForVariant(
  supabase: any,
  variantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("content_release_items")
    .select("release_id")
    .eq("variant_id", variantId);
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const releaseIds = [...new Set(data.map((r: { release_id: string }) => r.release_id))];
  for (const rid of releaseIds) {
    const rel = await getRelease(supabase, rid);
    if (rel?.status === "scheduled") return rid;
  }
  return null;
}
