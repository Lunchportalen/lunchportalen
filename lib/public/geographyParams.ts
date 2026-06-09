export type StartIntent = "demo" | "register";

const POSTAL_RE = /^\d{4}$/;

export function normalizePostalCode(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 4);
}

export function isValidPostalCode(raw: string): boolean {
  return POSTAL_RE.test(normalizePostalCode(raw));
}

export function normalizeCity(raw: string): string {
  return String(raw ?? "").trim().slice(0, 128);
}

export function isValidCity(raw: string): boolean {
  const city = normalizeCity(raw);
  return city.length >= 1 && city.length <= 128;
}

export function resolveStartIntent(raw: string | null | undefined): StartIntent {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "register" ? "register" : "demo";
}

export function resolveSource(raw: string | null | undefined, fallback = "start-direct"): string {
  const source = String(raw ?? "").trim();
  if (source) return source.slice(0, 128);
  return fallback;
}

export function hasGeographyParams(postalCode: string | null | undefined, city: string | null | undefined): boolean {
  return isValidPostalCode(String(postalCode ?? "")) && isValidCity(String(city ?? ""));
}

/** True when /start should skip role chooser and go straight to bedrift/geografi-flyt. */
export function shouldSkipStartRoleGate(
  intent: string | null | undefined,
  postalCode?: string | null | undefined,
  city?: string | null | undefined,
): boolean {
  const normalizedIntent = String(intent ?? "").trim().toLowerCase();
  if (normalizedIntent === "demo" || normalizedIntent === "register") return true;
  return hasGeographyParams(postalCode, city);
}

export function buildContinuationPath(
  intent: StartIntent,
  params: { postalCode: string; city: string; source: string },
): string {
  const qs = new URLSearchParams({
    postal_code: normalizePostalCode(params.postalCode),
    city: normalizeCity(params.city),
    source: resolveSource(params.source),
  });

  if (intent === "register") {
    return `/registrering?${qs.toString()}`;
  }

  return `/demo?${qs.toString()}`;
}

export function buildStartRedirectPath(
  intent: StartIntent,
  params: { source?: string | null; postalCode?: string | null; city?: string | null },
): string {
  const qs = new URLSearchParams({ intent });
  const source = resolveSource(params.source, intent === "register" ? "register-direct" : "demo-direct");
  qs.set("source", source);
  if (params.postalCode && isValidPostalCode(params.postalCode)) {
    qs.set("postal_code", normalizePostalCode(params.postalCode));
  }
  if (params.city && isValidCity(params.city)) {
    qs.set("city", normalizeCity(params.city));
  }
  return `/start?${qs.toString()}`;
}
