import "server-only";

import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { getCanonicalCmsSeedDataset } from "@/lib/localRuntime/cmsProvider";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/cms/contentTreePageKey";

function safeTrim(value: unknown): string {
  return String(value ?? "").trim();
}

const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);

type SeedPage = ReturnType<typeof getCanonicalCmsSeedDataset>["pages"][number];
type SeedVariant = ReturnType<typeof getCanonicalCmsSeedDataset>["variants"][number];

export function isRemoteBackendCmsHarnessEnabled(): boolean {
  const runtime = getCmsRuntimeStatus();
  const flag = safeTrim(process.env.LP_REMOTE_BACKEND_AUTH_HARNESS).toLowerCase();
  return runtime.mode === "remote_backend" && ENABLED_VALUES.has(flag) && hasSupabaseAdminConfig();
}

async function upsertPage(page: SeedPage): Promise<void> {
  const supabase = supabaseAdmin();
  const payload = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    page_key: page.page_key,
    tree_parent_id: page.tree_parent_id,
    tree_root_key: page.tree_root_key,
    tree_sort_order: page.tree_sort_order,
    created_at: page.created_at,
    updated_at: page.updated_at,
    published_at: page.published_at,
  };
  const { error } = await supabase.from("content_pages").upsert(payload, { onConflict: "id" });
  if (!error) return;

  if (isMissingColumnError(error, "page_key")) {
    const { page_key: _ignoredPageKey, ...payloadWithoutPageKey } = payload;
    const { error: retryError } = await supabase
      .from("content_pages")
      .upsert(payloadWithoutPageKey, { onConflict: "id" });
    if (!retryError) return;
    throw new Error(`Kunne ikke seed'e content_page ${page.id}: ${retryError.message}`);
  }

  throw new Error(`Kunne ikke seed'e content_page ${page.id}: ${error.message}`);
}

async function upsertVariant(variant: SeedVariant): Promise<void> {
  const supabase = supabaseAdmin();
  const payload = {
    id: variant.id,
    page_id: variant.page_id,
    locale: variant.locale,
    environment: variant.environment,
    body: variant.body,
    created_at: variant.created_at,
    updated_at: variant.updated_at,
  };
  const { data: existing, error: existingError } = await supabase
    .from("content_page_variants")
    .select("id")
    .eq("page_id", variant.page_id)
    .eq("locale", variant.locale)
    .eq("environment", variant.environment)
    .maybeSingle();
  if (existingError) {
    throw new Error(
      `Kunne ikke lese eksisterende variant ${variant.page_id}/${variant.locale}/${variant.environment}: ${existingError.message}`,
    );
  }
  if (existing?.id && existing.id !== variant.id) {
    const { error: deleteError } = await supabase.from("content_page_variants").delete().eq("id", existing.id);
    if (deleteError) {
      throw new Error(`Kunne ikke rydde kolliderende variant ${existing.id}: ${deleteError.message}`);
    }
  }
  const { error } = await supabase.from("content_page_variants").upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(`Kunne ikke seed'e content_page_variant ${variant.id}: ${error.message}`);
  }
}

async function ensureCanonicalSlugMapping(page: SeedPage): Promise<void> {
  const supabase = supabaseAdmin();
  const normalizedSlug = safeTrim(page.slug).toLowerCase();
  if (!normalizedSlug) return;
  const { data, error } = await supabase
    .from("content_pages")
    .select("id, slug")
    .eq("slug", normalizedSlug);
  if (error) {
    throw new Error(`Kunne ikke lese content_pages for slug ${page.slug}: ${error.message}`);
  }
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const rowId = safeTrim(row?.id);
    const rowSlug = safeTrim(row?.slug).toLowerCase();
    if (!rowId || rowId === page.id || rowSlug !== normalizedSlug) continue;
    const replacementSlug = `${normalizedSlug}-${rowId.slice(0, 8)}`;
    const { error: updateError } = await supabase
      .from("content_pages")
      .update({ slug: replacementSlug, updated_at: new Date().toISOString() })
      .eq("id", rowId);
    if (updateError) {
      throw new Error(
        `Kunne ikke flytte kolliderende slug ${normalizedSlug} fra ${rowId}: ${updateError.message}`,
      );
    }
  }
}

async function ensureCanonicalPage(page: SeedPage): Promise<void> {
  await ensureCanonicalSlugMapping(page);
  await upsertPage(page);
}

export async function ensureRemoteBackendCmsHarnessContent(): Promise<{
  ok: true;
  pageIds: string[];
  slugs: string[];
}> {
  const dataset = getCanonicalCmsSeedDataset();

  for (const page of dataset.pages) {
    await ensureCanonicalPage(page);
  }

  for (const variant of dataset.variants) {
    await upsertVariant(variant);
  }

  return {
    ok: true,
    pageIds: dataset.pages.map((page) => page.id),
    slugs: dataset.pages.map((page) => page.slug),
  };
}

export async function ensureRemoteBackendCmsHarnessContentIfEnabled(): Promise<void> {
  if (!isRemoteBackendCmsHarnessEnabled()) return;
  await ensureRemoteBackendCmsHarnessContent();
}
