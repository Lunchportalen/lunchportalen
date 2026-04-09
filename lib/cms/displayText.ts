/** Normalize CMS-visible text (shared by renderBlock + locked enterprise blocks). */
export function normalizeDisplayText(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}
