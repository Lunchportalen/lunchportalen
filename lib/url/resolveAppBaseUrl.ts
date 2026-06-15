/** Canonical production app origin (employee/admin/provider portal). */
export const CANONICAL_PRODUCTION_APP_URL = "https://app.lunchportalen.no";

export const CANONICAL_PRODUCTION_APP_HOST = "app.lunchportalen.no";

export const LOCAL_DEV_APP_URL = "http://localhost:3000";

export type ResolveAppBaseUrlInput = {
  appUrl?: string | null;
  publicAppUrl?: string | null;
  nextPublicAppUrl?: string | null;
  vercelUrl?: string | null;
  vercelEnv?: string | null;
  nodeEnv?: string | null;
  /** Incoming request host (x-forwarded-host or host). Used to block localhost on deployed hosts. */
  requestHost?: string | null;
};

function normalizeBaseUrl(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const withScheme = s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
  return withScheme.replace(/\/+$/, "");
}

function normalizeHost(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.split(",")[0]?.trim().split(":")[0] ?? "";
}

function isLocalhostBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

function isLocalhostHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function isCanonicalProductionHost(host: string): boolean {
  return host === CANONICAL_PRODUCTION_APP_HOST;
}

function readInput(input: ResolveAppBaseUrlInput = {}): Required<Omit<ResolveAppBaseUrlInput, "requestHost">> & {
  requestHost: string | null;
} {
  return {
    appUrl: input.appUrl ?? process.env.APP_URL ?? null,
    publicAppUrl: input.publicAppUrl ?? process.env.PUBLIC_APP_URL ?? null,
    nextPublicAppUrl: input.nextPublicAppUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? null,
    vercelUrl: input.vercelUrl ?? process.env.VERCEL_URL ?? null,
    vercelEnv: input.vercelEnv ?? process.env.VERCEL_ENV ?? null,
    nodeEnv: input.nodeEnv ?? process.env.NODE_ENV ?? null,
    requestHost: input.requestHost ?? null,
  };
}

/** First non-empty configured app URL (before production guardrails). */
export function pickExplicitAppUrl(input: ResolveAppBaseUrlInput = {}): string {
  const env = readInput(input);
  for (const raw of [env.appUrl, env.publicAppUrl, env.nextPublicAppUrl, env.vercelUrl]) {
    const normalized = normalizeBaseUrl(String(raw ?? ""));
    if (normalized) return normalized;
  }
  return "";
}

function forceCanonicalProduction(input: ResolveAppBaseUrlInput): boolean {
  const env = readInput(input);
  const host = normalizeHost(env.requestHost);
  if (isCanonicalProductionHost(host)) return true;
  if (String(env.vercelEnv ?? "").trim() === "production") return true;
  return false;
}

function resolveNonLocalhostDeployedBase(input: ResolveAppBaseUrlInput, explicit: string): string {
  const host = normalizeHost(readInput(input).requestHost);
  if (host && !isLocalhostHost(host)) {
    if (explicit && !isLocalhostBaseUrl(explicit)) return explicit;
    return CANONICAL_PRODUCTION_APP_URL;
  }
  return explicit;
}

/**
 * Resolve public app base URL for auth links, invites, etc.
 *
 * Production (VERCEL_ENV=production or app.lunchportalen.no host) never falls back to localhost.
 */
export function resolveAppBaseUrl(input: ResolveAppBaseUrlInput = {}): string {
  const env = readInput(input);
  const vercelEnv = String(env.vercelEnv ?? "").trim();
  const nodeEnv = String(env.nodeEnv ?? "").trim();
  const explicit = pickExplicitAppUrl(input);

  if (forceCanonicalProduction(input)) {
    if (explicit && !isLocalhostBaseUrl(explicit)) return explicit;
    return CANONICAL_PRODUCTION_APP_URL;
  }

  if (explicit) {
    if (isLocalhostBaseUrl(explicit)) {
      const resolved = resolveNonLocalhostDeployedBase(input, explicit);
      if (nodeEnv === "production" && resolved === explicit) {
        throw new Error("APP_URL peker til localhost i produksjon.");
      }
      return resolved;
    }
    return explicit;
  }

  const isLocalDev = nodeEnv !== "production" && !vercelEnv;
  const host = normalizeHost(env.requestHost);
  if (isLocalDev && (!host || isLocalhostHost(host))) return LOCAL_DEV_APP_URL;

  if (nodeEnv === "production" || vercelEnv === "preview") {
    throw new Error("APP_URL er ikke satt for deploy.");
  }

  if (host && !isLocalhostHost(host)) {
    return CANONICAL_PRODUCTION_APP_URL;
  }

  return LOCAL_DEV_APP_URL;
}

/**
 * Password reset redirect must not depend on baked NEXT_PUBLIC_APP_URL alone.
 * Request host + production deployment signals win over localhost env.
 */
export function resolvePasswordResetRedirectUrl(input: ResolveAppBaseUrlInput = {}): string {
  const env = readInput(input);
  const host = normalizeHost(env.requestHost);
  const explicit = pickExplicitAppUrl(input);

  if (isCanonicalProductionHost(host)) {
    return `${CANONICAL_PRODUCTION_APP_URL}/reset-password`;
  }

  if (String(env.vercelEnv ?? "").trim() === "production") {
    if (explicit && !isLocalhostBaseUrl(explicit)) return `${explicit}/reset-password`;
    return `${CANONICAL_PRODUCTION_APP_URL}/reset-password`;
  }

  if (host && !isLocalhostHost(host)) {
    if (explicit && !isLocalhostBaseUrl(explicit)) return `${explicit}/reset-password`;
    return `${CANONICAL_PRODUCTION_APP_URL}/reset-password`;
  }

  return `${resolveAppBaseUrl(input)}/reset-password`;
}
