/**
 * Phase 20: Content releases (batch publish + scheduled). Server-only.
 */

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

export async function publishVariant(
  supabase: any,
  pageId: string,
  variantId: string,
  env: "prod" | "staging",
  locale: "nb" | "en",
  actorEmail: string | null
): Promise<void> {
  if (env === "staging") return;
  const workflow = await getWorkflow(supabase, variantId, env, locale);
  if (workflow.state !== "approved") throw new Error("Workflow not approved");
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
      actorEmail
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
