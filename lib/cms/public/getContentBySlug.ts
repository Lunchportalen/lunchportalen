/**
 * Server-only: resolve CMS page + variant body by slug for public rendering.
 */
import { opsLog } from "@/lib/ops/log";
import {
  getLocalDevContentReservePageBySlug,
  isLocalDevContentReserveEnabled,
} from "@/lib/cms/contentLocalDevReserve";
import { ensureRemoteBackendCmsHarnessContentIfEnabled } from "@/lib/auth/remoteBackendCmsHarness";
import {
  getLocalCmsPublicContentBySlug,
} from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";

/**
 * Resolved live source before seed overlay.
 * Public `getContentBySlug` never returns `live-supabase` — Supabase editorial rows are read only via {@link readSupabasePublishedContentPageBySlug} (internal/backoffice/tests).
 */
export type PublicContentLiveOrigin = "live-umbraco" | "live-supabase" | "local-cms" | "local-reserve";

/** Full runtime label for DOM / verification: live sources + deterministic seeds. */
export type PublicContentRuntimeOrigin =
  | PublicContentLiveOrigin
  | "seed-no-row"
  | "seed-empty-body";

export type ContentBySlugResult = {
  pageId: string;
  slug: string;
  title: string | null;
  body: unknown;
  /** Which live source supplied this row (Umbraco Delivery, Supabase CMS, or local harness). */
  publicContentOrigin: PublicContentLiveOrigin;
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
    const local = getLocalCmsPublicContentBySlug(normalized, options ?? undefined);
    if (!local) return null;
    return { ...local, publicContentOrigin: "local-cms" };
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
      publicContentOrigin: "local-reserve",
    };
  }

  await ensureRemoteBackendCmsHarnessContentIfEnabled();

  const umbracoBaseUrl = String(process.env.UMBRACO_DELIVERY_BASE_URL ?? "").trim();

  const { fetchMarketingFromUmbracoBySlug, isMarketingSlugUmbracoAllowlisted } = await import(
    "@/lib/cms/umbraco/marketingAdapter",
  );

  if (isMarketingSlugUmbracoAllowlisted(normalized)) {
    if (!umbracoBaseUrl) {
      opsLog("cms_marketing_umbraco_delivery_missing_fail_closed", { slug: normalized });
      return null;
    }
    try {
      const u = await fetchMarketingFromUmbracoBySlug(normalized, options);
      if (u) {
        const { overlayRunningExperimentOnBody } = await import("@/lib/experiments/overlayRunningExperiment");
        const overlaid = await overlayRunningExperimentOnBody({
          pageId: u.pageId,
          baseBody: u.body,
          preview: options?.preview === true,
          experimentSubjectKey: options?.experimentSubjectKey,
          experimentUseRandomSplit: options?.experimentUseRandomSplit === true,
        });
        return {
          pageId: u.pageId,
          slug: u.slug,
          title: u.title,
          body: overlaid.body,
          experimentAssignment: overlaid.assignment ?? null,
          publicContentOrigin: "live-umbraco",
        };
      }
    } catch (err) {
      opsLog("cms_marketing_umbraco_read_failed", {
        slug: normalized,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    /** Allowlisted public routes: no Supabase editorial substitute — Umbraco Delivery must serve content. */
    opsLog("cms_marketing_umbraco_allowlisted_miss_fail_closed", { slug: normalized });
    return null;
  }

  /** Non-allowlisted slugs: public resolver does not read Supabase (operational/editorial DB is not public marketing truth). */
  return null;
}
