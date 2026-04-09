/**
 * Draft workspace rows use `content_page_variants.environment = 'preview'`
 * (DB check allows prod | staging | preview only).
 */
export const CMS_DRAFT_ENVIRONMENT = "preview" as const;
