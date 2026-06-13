// lib/menu/providerMenuScope.ts
// Provider-scope for menyinnhold (multi-provider runtime foundation).
//
// Prinsipp:
// - provider_id utledes ALLTID server-side fra Supabase (companies.provider_id).
//   Aldri fra klientinput.
// - Sanity menuDay-queries scopes via providers.slug (matcher provider-mirror i Sanity).
// - Fail-closed: provider uten slug, eller lookup-feil, gir ALDRI unscoped query
//   (det kunne eksponert en annen providers meny). Resultatet blir tom meny.
// - Legacy: company uten provider_id beholder dagens unscoped lesing (logges),
//   slik at eksisterende flyt ikke regredierer. Ingen Melhus-hardcoding.

import "server-only";

export type ProviderMenuScope = {
  providerId: string;
  providerSlug: string | null;
  providerName: string | null;
};

export type ProviderMenuScopeResult =
  | { ok: true; scope: ProviderMenuScope }
  | { ok: false; reason: "COMPANY_NOT_FOUND" | "NO_PROVIDER" | "LOOKUP_FAILED"; detail?: string };

/**
 * Beslutning for menuDay-lesing gitt et scope-resultat:
 * - "scoped":          query filtreres på providerSlug
 * - "legacy-unscoped": company har ingen provider — dagens (globale) lesing beholdes
 * - "fail-closed":     provider finnes men kan ikke scopes trygt — IKKE hent menuDay
 */
export type MenuScopeDecision =
  | { mode: "scoped"; providerId: string; providerSlug: string }
  | { mode: "legacy-unscoped" }
  | { mode: "fail-closed"; reason: string };

type MinimalDbClient = {
  from: (table: string) => any;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Finner provider-scope for meny gitt companyId (server truth).
 * Klient: send inn eksisterende server-side klient (admin) fra ruten.
 */
export async function resolveProviderMenuScopeForCompany(
  db: MinimalDbClient,
  companyId: string,
): Promise<ProviderMenuScopeResult> {
  const cid = safeStr(companyId);
  if (!cid) return { ok: false, reason: "COMPANY_NOT_FOUND" };

  let providerId = "";
  try {
    const { data, error } = await db
      .from("companies")
      .select("id, provider_id")
      .eq("id", cid)
      .maybeSingle();

    if (error) return { ok: false, reason: "LOOKUP_FAILED", detail: safeStr(error.message) };
    if (!data) return { ok: false, reason: "COMPANY_NOT_FOUND" };

    providerId = safeStr((data as { provider_id?: unknown }).provider_id);
  } catch (e: unknown) {
    return { ok: false, reason: "LOOKUP_FAILED", detail: safeStr((e as { message?: string })?.message ?? e) };
  }

  if (!providerId) return { ok: false, reason: "NO_PROVIDER" };

  try {
    const { data, error } = await db
      .from("providers")
      .select("id, slug, name")
      .eq("id", providerId)
      .maybeSingle();

    if (error) return { ok: false, reason: "LOOKUP_FAILED", detail: safeStr(error.message) };

    // provider_id satt men providers-rad mangler: behandles som lookup-feil
    // (fail-closed nedstrøms) — aldri stille unscoped.
    if (!data) return { ok: false, reason: "LOOKUP_FAILED", detail: "PROVIDER_ROW_MISSING" };

    const row = data as { id?: unknown; slug?: unknown; name?: unknown };
    return {
      ok: true,
      scope: {
        providerId: safeStr(row.id) || providerId,
        providerSlug: safeStr(row.slug) || null,
        providerName: safeStr(row.name) || null,
      },
    };
  } catch (e: unknown) {
    return { ok: false, reason: "LOOKUP_FAILED", detail: safeStr((e as { message?: string })?.message ?? e) };
  }
}

/**
 * Ren (testbar) beslutning: hvordan skal menuDay leses for dette scope-resultatet?
 *
 * Sikkerhetsregler:
 * - Provider med slug → scoped query.
 * - Provider uten slug → fail-closed (unscoped ville lekket andre providers meny).
 * - Lookup-feil → fail-closed (aldri gjett).
 * - Ingen provider på company → legacy unscoped (dagens atferd, ingen provider å lekke fra).
 */
export function menuScopeDecision(result: ProviderMenuScopeResult): MenuScopeDecision {
  if (result.ok === false) {
    if (result.reason === "NO_PROVIDER") return { mode: "legacy-unscoped" };
    return { mode: "fail-closed", reason: result.reason };
  }
  if (result.scope.providerSlug) {
    return { mode: "scoped", providerId: result.scope.providerId, providerSlug: result.scope.providerSlug };
  }
  return { mode: "fail-closed", reason: "PROVIDER_MISSING_SLUG" };
}
