/** Studio-side Melhus provider ref (matches Supabase + lib/cms/providerSanityConstants). */
export const MELHUS_PROVIDER_SANITY_ID = "11111111-1111-1111-1111-111111111111";

export function melhusProviderReference() {
  return { _type: "reference" as const, _ref: MELHUS_PROVIDER_SANITY_ID };
}
