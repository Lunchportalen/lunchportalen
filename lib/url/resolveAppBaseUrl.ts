/** Canonical production app origin (employee/admin/provider portal). */
export const CANONICAL_PRODUCTION_APP_URL = "https://app.lunchportalen.no";

export const LOCAL_DEV_APP_URL = "http://localhost:3000";

export type ResolveAppBaseUrlInput = {
  appUrl?: string | null;
  publicAppUrl?: string | null;
  nextPublicAppUrl?: string | null;
  vercelUrl?: string | null;
  vercelEnv?: string | null;
  nodeEnv?: string | null;
};

function normalizeBaseUrl(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const withScheme = s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
  return withScheme.replace(/\/+$/, "");
}

function isLocalhostBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

function readInput(input: ResolveAppBaseUrlInput = {}): Required<ResolveAppBaseUrlInput> {
  return {
    appUrl: input.appUrl ?? process.env.APP_URL ?? null,
    publicAppUrl: input.publicAppUrl ?? process.env.PUBLIC_APP_URL ?? null,
    nextPublicAppUrl: input.nextPublicAppUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? null,
    vercelUrl: input.vercelUrl ?? process.env.VERCEL_URL ?? null,
    vercelEnv: input.vercelEnv ?? process.env.VERCEL_ENV ?? null,
    nodeEnv: input.nodeEnv ?? process.env.NODE_ENV ?? null,
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

/**
 * Resolve public app base URL for auth links, invites, etc.
 *
 * Production (VERCEL_ENV=production) never falls back to localhost.
 */
export function resolveAppBaseUrl(input: ResolveAppBaseUrlInput = {}): string {
  const env = readInput(input);
  const vercelEnv = String(env.vercelEnv ?? "").trim();
  const nodeEnv = String(env.nodeEnv ?? "").trim();
  const explicit = pickExplicitAppUrl(env);

  if (vercelEnv === "production") {
    if (explicit && !isLocalhostBaseUrl(explicit)) return explicit;
    return CANONICAL_PRODUCTION_APP_URL;
  }

  if (explicit) {
    if (nodeEnv === "production" && isLocalhostBaseUrl(explicit)) {
      throw new Error("APP_URL peker til localhost i produksjon.");
    }
    return explicit;
  }

  const isLocalDev = nodeEnv !== "production" && !vercelEnv;
  if (isLocalDev) return LOCAL_DEV_APP_URL;

  if (nodeEnv === "production" || vercelEnv === "preview") {
    throw new Error("APP_URL er ikke satt for deploy.");
  }

  return LOCAL_DEV_APP_URL;
}

export function resolvePasswordResetRedirectUrl(input: ResolveAppBaseUrlInput = {}): string {
  return `${resolveAppBaseUrl(input)}/reset-password`;
}
