/**
 * Server-only: resolve CMS page + variant body by slug for public rendering.
 */
import {
  getLocalDevContentReservePageBySlug,
  isLocalDevContentReserveEnabled,
} from "@/lib/cms/contentLocalDevReserve";
import { ensureRemoteBackendCmsHarnessContentIfEnabled } from "@/lib/auth/remoteBackendCmsHarness";
import {
  getLocalCmsPublicContentBySlug,
} from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";

export type ContentBySlugResult = {
  pageId: string;
  slug: string;
  title: string | null;
  body: unknown;
  /** Present when a running traffic experiment assigned a variant for this request. */
  experimentAssignment?: { experimentId: string; variantId: string } | null;
};

/**
 * `preview: true` loads `content_page_variants.environment = 'preview'` (draft workspace in DB schema).
 * No silent fallback to prod when the preview variant is missing.
 */
export type GetContentBySlugOptions = {
  preview?: boolean;
  /** Override stable subject for deterministic A/B (else derived from request headers when possible). */
  experimentSubjectKey?: string | null;
  /** When true, 50/50 random between first two variants (logged); otherwise deterministic assignment. */
  experimentUseRandomSplit?: boolean;
};

export async function getContentBySlug(
  slug: string,
  options?: GetContentBySlugOptions,
): Promise<ContentBySlugResult | null> {
  if (!slug || typeof slug !== "string") return null;
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  if (isLocalCmsRuntimeEnabled()) {
    return getLocalCmsPublicContentBySlug(normalized, options ?? undefined);
  }

  if (isLocalDevContentReserveEnabled()) {
    const reservePage = getLocalDevContentReservePageBySlug(normalized);
    if (!reservePage) return null;
    return {
      pageId: reservePage.id,
      slug: reservePage.slug,
      title: reservePage.title,
      body: reservePage.body,
      experimentAssignment: null,
    };
  }

  await ensureRemoteBackendCmsHarnessContentIfEnabled();

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = supabaseAdmin();
  const { data: page, error: pageError } = await supabase
    .from("content_pages")
    .select("id, slug, title, status")
    .eq("slug", normalized)
    .eq("status", "published")
    .maybeSingle();
  if (pageError || !page?.id) return null;
  const environment = options?.preview === true ? "preview" : "prod";
  const { data: variant, error: variantError } = await supabase
    .from("content_page_variants")
    .select("id, body")
    .eq("page_id", page.id)
    .eq("locale", "nb")
    .eq("environment", environment)
    .maybeSingle();
  if (variantError || !variant) return null;
  const body = variant.body ?? null;

  const { overlayRunningExperimentOnBody } = await import("@/lib/experiments/overlayRunningExperiment");
  const overlaid = await overlayRunningExperimentOnBody({
    pageId: page.id,
    baseBody: body,
    preview: options?.preview === true,
    experimentSubjectKey: options?.experimentSubjectKey,
    experimentUseRandomSplit: options?.experimentUseRandomSplit === true,
  });

  return {
    pageId: page.id,
    slug: String(page.slug ?? normalized),
    title: page.title ?? null,
    body: overlaid.body,
    experimentAssignment: overlaid.assignment ?? null,
  };
}
