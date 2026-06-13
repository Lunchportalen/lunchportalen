/**
 * GROQ fragment for optional provider scoping on menuDay reads (Patch 12).
 */
export type MenuDayProviderFilterOpts = {
  providerSlug?: string | null;
  /** Supabase providers.id (== Sanity provider `_id`). Preferred when slug mirror is missing. */
  providerRef?: string | null;
};

function normalizeOpts(providerSlugOrOpts?: string | null | MenuDayProviderFilterOpts): MenuDayProviderFilterOpts {
  if (typeof providerSlugOrOpts === "string" || providerSlugOrOpts == null) {
    return { providerSlug: typeof providerSlugOrOpts === "string" ? providerSlugOrOpts : null };
  }
  return providerSlugOrOpts;
}

export function menuDayProviderGroqClause(providerSlugOrOpts?: string | null | MenuDayProviderFilterOpts): {
  clause: string;
  params: Record<string, string>;
  legacyUnscoped: boolean;
} {
  const { providerSlug, providerRef } = normalizeOpts(providerSlugOrOpts);
  const slug = String(providerSlug ?? "").trim();
  const ref = String(providerRef ?? "").trim();

  if (ref && slug) {
    return {
      clause: "(provider._ref == $providerRef || provider->slug.current == $providerSlug)",
      params: { providerRef: ref, providerSlug: slug },
      legacyUnscoped: false,
    };
  }

  if (ref) {
    return {
      clause: "provider._ref == $providerRef",
      params: { providerRef: ref },
      legacyUnscoped: false,
    };
  }

  if (slug) {
    return {
      clause: "provider->slug.current == $providerSlug",
      params: { providerSlug: slug },
      legacyUnscoped: false,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[menuDay] providerSlug undefined — unscoped menuDay query (legacy). Set provider slug before multi-provider go-live.",
    );
  }
  return { clause: "true", params: {}, legacyUnscoped: true };
}
