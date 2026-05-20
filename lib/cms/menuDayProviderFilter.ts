/**
 * GROQ fragment for optional provider slug scoping on menuDay reads (Patch 12).
 */
export function menuDayProviderGroqClause(providerSlug?: string | null): {
  clause: string;
  params: Record<string, string>;
  legacyUnscoped: boolean;
} {
  const slug = String(providerSlug ?? "").trim();
  if (!slug) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[menuDay] providerSlug undefined — unscoped menuDay query (legacy). Set provider slug before multi-provider go-live.",
      );
    }
    return { clause: "true", params: {}, legacyUnscoped: true };
  }
  return {
    clause: "provider->slug.current == $providerSlug",
    params: { providerSlug: slug },
    legacyUnscoped: false,
  };
}
