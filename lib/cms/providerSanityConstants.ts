/**
 * Sanity provider mirror constants (Patch 12).
 * _id matches Supabase `providers.id` — single source for migrations and GROQ filters.
 */
export const MELHUS_PROVIDER_SANITY_ID = "11111111-1111-1111-1111-111111111111";

/** Supabase slug (Patch 5 seed). */
export const MELHUS_PROVIDER_SLUG = "melhus-catering";

export const MELHUS_PROVIDER_NAME = "Melhus Catering AS";

export function melhusProviderReference() {
  return { _type: "reference" as const, _ref: MELHUS_PROVIDER_SANITY_ID };
}
