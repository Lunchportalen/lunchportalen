/**
 * U30R — Når `content_pages.page_key` mangler i DB, kan vi likevel utlede stabil kind fra kjente slug-verdier
 * (samme mapping som migrasjon 20260417010000). Én sann kilde for inferens — brukes av tree-API.
 */
const SLUG_TO_PAGE_KEY: Record<string, string> = {
  home: "home",
  week: "employee_week",
  superadmin: "superadmin",
  "company-admin": "company_admin",
  kitchen: "kitchen",
  driver: "driver",
  dashboard: "overlay_dashboard",
  header: "global_header",
  footer: "global_footer",
  "design-tokens": "design_tokens",
};

export function inferPageKeyFromSlug(slug: string | null | undefined): string | null {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s) return null;
  return SLUG_TO_PAGE_KEY[s] ?? null;
}

export function isMissingColumnError(e: unknown, columnName: string): boolean {
  const msg = serializeErr(e).toLowerCase();
  const col = columnName.toLowerCase();
  if (!msg.includes(col)) return false;
  return (
    msg.includes("does not exist") ||
    (msg.includes("column") && msg.includes(col)) ||
    msg.includes("undefined column")
  );
}

function serializeErr(e: unknown): string {
  if (e == null) return "";
  if (e instanceof Error) return e.message || "";
  if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Fyll inn `page_key` fra slug når kolonne mangler eller er null (legacy rader). */
export function applyInferredPageKeys<
  T extends { page_key: string | null; slug: string | null },
>(pages: T[]): T[] {
  return pages.map((p) => {
    const pk = (p.page_key ?? "").trim();
    if (pk) return p;
    const inferred = inferPageKeyFromSlug(p.slug);
    if (!inferred) return p;
    return { ...p, page_key: inferred };
  });
}
