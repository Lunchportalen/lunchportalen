/**
 * CMS slug types + Supabase published reader. Public Umbraco marketing resolver removed (FASE 14-UI-2 D+E).
 */
export type {
  ContentBySlugResult,
  GetContentBySlugOptions,
  PublicContentLiveOrigin,
  PublicContentRuntimeOrigin,
} from "./contentPageResult";

export { readSupabasePublishedContentPageBySlug } from "./supabase/readPublishedContentPageBySlug";
