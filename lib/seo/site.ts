const RAW_SITE_URL = "https://www.lunchportalen.no";

function normalizeBaseUrl(input: string): string {
  const value = String(input ?? "").trim();
  if (!value) {
    throw new Error("SEO_SITE_URL_MISSING");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SEO_SITE_URL_INVALID");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SEO_SITE_URL_PROTOCOL_INVALID");
  }

  const normalized = parsed.href.endsWith("/") ? parsed.href.slice(0, -1) : parsed.href;
  if (normalized.endsWith("/")) {
    throw new Error("SEO_SITE_URL_TRAILING_SLASH");
  }

  return normalized;
}

export const SITE_URL = normalizeBaseUrl(RAW_SITE_URL);

function stripQueryAndHash(path: string): string {
  const q = path.indexOf("?");
  const h = path.indexOf("#");
  const cut = Math.min(q === -1 ? path.length : q, h === -1 ? path.length : h);
  return path.slice(0, cut);
}

export function normalizePath(path: string): string {
  const raw = String(path ?? "").trim();
  const stripped = stripQueryAndHash(raw);
  if (!stripped) return "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

export function absoluteUrl(path: string): string {
  const normalized = normalizePath(path);
  return normalized === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

export function canonicalForPath(path: string): string {
  return absoluteUrl(path);
}

export function siteName(): string {
  return "Lunchportalen";
}

export function pageMetaDefaults() {
  return {
    titleBase: "Lunchportalen",
    descriptionBase: "Firmalunsj med kontroll, forutsigbarhet og cut-off kl. 08:00.",
    siteName: siteName(),
    locale: "nb_NO",
    type: "website" as const,
    ogImageDefault: "/og/og-default-1200x630.jpg",
  };
}

/** Default OG image only (marketing-registry removed with app-domain marketing). */
export function ogImageForPath(_path: string, opts?: { strict?: boolean }): string {
  void _path;
  const fallback = pageMetaDefaults().ogImageDefault;

  if (!fallback && opts?.strict) {
    throw new Error(`SEO_OG_IMAGE_MISSING_FOR_PATH:${normalizePath(String(_path ?? ""))}`);
  }

  if (fallback.startsWith("http://") || fallback.startsWith("https://")) {
    return fallback;
  }

  if (!fallback.startsWith("/")) {
    if (opts?.strict) {
      throw new Error(`SEO_OG_IMAGE_INVALID_FOR_PATH:${normalizePath(String(_path ?? ""))}`);
    }
    return absoluteUrl(pageMetaDefaults().ogImageDefault);
  }

  return absoluteUrl(fallback);
}

export function ogImageUrl(opts: { path: string; strict?: boolean }): string {
  return ogImageForPath(opts.path, { strict: opts.strict });
}
