// lib/menu-publish/resolveMenuDayProvider.ts
// Provider-mapping for Sanity menuDay → Supabase provider scope (sync-laget).
//
// Prinsipp (speiler lib/menu/providerMenuScope.ts for runtime-lesing):
// - Sanity provider-mirror har `_id` == Supabase `providers.id`
//   (se lib/cms/syncProviderToSanity.ts og lib/cms/providerSanityConstants.ts).
// - Fail-closed: menuDay uten provider-ref, eller provider som ikke finnes i
//   Supabase, gir ALDRI global/unscoped sync. Ingen Melhus-fallback,
//   ingen «første provider»-fallback.
// - Server-side only. Ingen schema/RLS-endring.

import "server-only";

export type MenuDayProviderScope = {
  providerId: string;
  providerSlug: string | null;
};

export type MenuDayProviderScopeResult =
  | { ok: true; scope: MenuDayProviderScope }
  | { ok: false; reason: "MISSING_PROVIDER_REF" | "PROVIDER_NOT_FOUND" | "LOOKUP_FAILED"; detail?: string };

type MinimalDbClient = {
  from: (table: string) => any;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Leser provider-referansen fra et Sanity menuDay-dokument (webhook-payload
 * eller GROQ-projeksjon). Returnerer "" hvis referansen mangler.
 */
export function extractMenuDayProviderRef(doc: Record<string, unknown> | null | undefined): string {
  if (!doc || typeof doc !== "object") return "";

  const provider = doc.provider;
  if (provider && typeof provider === "object") {
    return safeStr((provider as { _ref?: unknown })._ref);
  }

  // GROQ-projeksjoner kan flate ut til "providerRef": provider._ref
  return safeStr((doc as { providerRef?: unknown }).providerRef);
}

/**
 * Slår opp Sanity provider-ref mot Supabase `providers` (id == Sanity `_id`).
 * Fail-closed: mangler ref eller rad → ingen scope, aldri fallback.
 */
export async function resolveMenuDayProviderScope(
  db: MinimalDbClient,
  providerRef: string,
): Promise<MenuDayProviderScopeResult> {
  const ref = safeStr(providerRef);
  if (!ref) return { ok: false, reason: "MISSING_PROVIDER_REF" };

  try {
    const { data, error } = await db
      .from("providers")
      .select("id, slug")
      .eq("id", ref)
      .maybeSingle();

    if (error) return { ok: false, reason: "LOOKUP_FAILED", detail: safeStr(error.message) };
    if (!data) return { ok: false, reason: "PROVIDER_NOT_FOUND" };

    const row = data as { id?: unknown; slug?: unknown };
    return {
      ok: true,
      scope: {
        providerId: safeStr(row.id) || ref,
        providerSlug: safeStr(row.slug) || null,
      },
    };
  } catch (e: unknown) {
    return { ok: false, reason: "LOOKUP_FAILED", detail: safeStr((e as { message?: string })?.message ?? e) };
  }
}
