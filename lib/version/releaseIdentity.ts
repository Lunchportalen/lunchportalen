/**
 * Canonical release identity for health, observability, and staging certification.
 *
 * Priority (fail-closed when none resolve to a non-empty SHA-like value):
 * 1. VERCEL_GIT_COMMIT_SHA — Git-integrated Vercel deployments
 * 2. APP_VERSION — controlled non-Git builds (CLI staging deploy)
 * 3. NEXT_PUBLIC_APP_VERSION — build-time mirror (optional)
 *
 * Never returns "unknown" in production/staging RC paths; callers treat missing as failure.
 */

export type ReleaseIdentitySource =
  | "vercel_git_commit_sha"
  | "app_version"
  | "next_public_app_version"
  | "vercel_git_commit_ref"
  | "missing";

export type ReleaseIdentity = {
  version: string;
  source: ReleaseIdentitySource;
  /** Full 40-char git SHA when verifiable; otherwise empty. */
  gitSha: string | null;
  ok: boolean;
};

const SHA40 = /^[0-9a-f]{40}$/i;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeCandidate(raw: unknown): string {
  return safeStr(raw);
}

export function resolveReleaseIdentity(env: Record<string, string | undefined> = process.env): ReleaseIdentity {
  const vercelSha = normalizeCandidate(env.VERCEL_GIT_COMMIT_SHA);
  if (vercelSha && SHA40.test(vercelSha)) {
    return { version: vercelSha.toLowerCase(), source: "vercel_git_commit_sha", gitSha: vercelSha.toLowerCase(), ok: true };
  }

  const appVersion = normalizeCandidate(env.APP_VERSION);
  if (appVersion && appVersion !== "unknown") {
    const gitSha = SHA40.test(appVersion) ? appVersion.toLowerCase() : null;
    return { version: appVersion, source: "app_version", gitSha, ok: true };
  }

  const publicVersion = normalizeCandidate(env.NEXT_PUBLIC_APP_VERSION);
  if (publicVersion && publicVersion !== "unknown") {
    const gitSha = SHA40.test(publicVersion) ? publicVersion.toLowerCase() : null;
    return { version: publicVersion, source: "next_public_app_version", gitSha, ok: true };
  }

  const vercelRef = normalizeCandidate(env.VERCEL_GIT_COMMIT_REF);
  if (vercelRef && vercelRef !== "unknown") {
    return { version: vercelRef, source: "vercel_git_commit_ref", gitSha: null, ok: true };
  }

  return { version: "", source: "missing", gitSha: null, ok: false };
}

/** Health contract: version must be present in remote-backend modes. */
export function releaseIdentityRequired(env: Record<string, string | undefined> = process.env): boolean {
  const nodeEnv = safeStr(env.NODE_ENV).toLowerCase();
  if (nodeEnv === "test") return false;
  const rcMode = safeStr(env.RC_MODE).toLowerCase() === "true";
  const vercelEnv = safeStr(env.VERCEL_ENV).toLowerCase();
  return rcMode || vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "staging";
}
