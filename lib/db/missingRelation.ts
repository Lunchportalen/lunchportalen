import "server-only";

/** Trimmet streng for robust feil-tekstanalyse (samme som i agreementStatus før ekstraksjon). */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Supabase/PostgREST: "relasjon finnes ikke", "schema cache", manglende tabell/kolonne.
 * Gjenbrukt av agreementStatus (billing hold) og superadmin invoice-ruter (fail-soft).
 */
export function isMissingRelationError(error: unknown, relation: string) {
  const e = error as any;
  const code = safeStr(e?.code).toUpperCase();
  const text = `${safeStr(e?.message)} ${safeStr(e?.details)} ${safeStr(e?.hint)}`.toLowerCase();
  const target = relation.toLowerCase();

  if (code === "42P01" || code === "PGRST205" || code === "PGRST204" || code === "42703") {
    return true;
  }

  const mentionsTarget = text.includes(target) || text.includes(`public.${target}`);
  const missingRelation =
    (text.includes("relation") && text.includes("does not exist")) ||
    (text.includes("schema cache") && text.includes("not found")) ||
    text.includes("could not find the table") ||
    text.includes("could not find table") ||
    text.includes("could not find the column") ||
    text.includes("could not find column");

  return mentionsTarget && missingRelation;
}
