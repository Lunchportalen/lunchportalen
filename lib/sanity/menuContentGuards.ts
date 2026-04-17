/**
 * Fail-closed helpers for Sanity `menuContent` in live surfaces.
 * Draft documents are excluded in GROQ; these guards catch empty shells that would mislead users.
 */
function stripHtmlLoose(input: string): string {
  return String(input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when there is customer-facing copy (title and/or description) beyond whitespace/empty HTML.
 * Used for employee UI and order gates — not for superadmin admin list (see getMenuForDatesAdmin).
 */
export function menuContentHasDisplayableCopy(
  m: { title?: string | null; description?: string | null } | null | undefined,
): boolean {
  if (!m) return false;
  const title = String(m.title ?? "").trim();
  if (title.length > 0) return true;
  const desc = stripHtmlLoose(String(m.description ?? ""));
  return desc.length > 0;
}
