/**
 * Forside / home page helpers for content editor.
 * Moved out of _stubs for a single, testable source of truth.
 */

export function getForsideBody(): { blocks: unknown[] } {
  return { blocks: [] };
}

export function isForside(slug: string, title: string): boolean {
  const sl = (slug ?? "").trim().toLowerCase();
  const t = (title ?? "").toLowerCase().trim();
  return (
    sl === "" ||
    sl === "/" ||
    sl === "index" ||
    sl === "hjem" ||
    sl === "front" ||
    sl === "forside" ||
    t === "forside" ||
    (t.includes("lunchportalen") && t.includes("firmalunsj"))
  );
}
