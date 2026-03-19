/**
 * Media ingest validation: URL and field limits.
 * Single place for POST (create) and PATCH (update) so records stay valid.
 */

/** Max length for alt text (accessibility). */
export const MEDIA_ALT_MAX = 180;

/** Max length for caption. */
export const MEDIA_CAPTION_MAX = 500;

/** Max number of tags per item. */
export const MEDIA_TAGS_MAX_COUNT = 20;

/** Max length per tag. */
export const MEDIA_TAG_MAX_LEN = 30;

/** Max URL length for media reference (avoid abuse). */
export const MEDIA_URL_MAX_LEN = 2048;

export type ValidateMediaUrlResult =
  | {
      ok: true;
      /**
       * Optional on success so callers can safely read `.code` / `.message`
       * on the union without extra narrowing.
       */
      code?: string;
      message?: string;
    }
  | { ok: false; code: string; message: string };

/**
 * Validates URL for media ingest. Only http/https allowed; rejects javascript:, data:, etc.
 * Fail closed: invalid URL → reject before creating record.
 */
export function validateMediaUrl(url: string): ValidateMediaUrlResult {
  const t = typeof url === "string" ? url.trim() : "";
  if (!t) return { ok: false, code: "MISSING_URL", message: "Mangler url." };
  if (t.length > MEDIA_URL_MAX_LEN) {
    return { ok: false, code: "URL_TOO_LONG", message: `URL må være på maks ${MEDIA_URL_MAX_LEN} tegn.` };
  }
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "Kun http- eller https-URL er tillatt." };
  }
  if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: "URL må starte med http:// eller https://." };
  }
  return { ok: true };
}
