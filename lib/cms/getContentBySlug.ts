/**
 * Public entry for CMS slug resolution (re-exports server implementation).
 */
export {
  getContentBySlug,
  type ContentBySlugResult,
  type GetContentBySlugOptions,
  type PublicContentLiveOrigin,
  type PublicContentRuntimeOrigin,
} from "./public/getContentBySlug";

/** Internal / tests — Supabase published row; not used for public marketing routes. */
export { readSupabasePublishedContentPageBySlug } from "./supabase/readPublishedContentPageBySlug";
