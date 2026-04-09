import "server-only";

/**
 * Enterprise control-plane strict flags (no silent bypass).
 * Set any to "1" / "true" (case-insensitive) to enable.
 *
 * - STRICT_MODE — single switch (also implied when CI=true): AI + CMS + DS server strict + throws on bypass warnings
 * - LP_STRICT_CONTROL — enables AI + CMS strict together
 * - LP_STRICT_AI — runAi must be under withAiDecisionEntrypoint (no implicit runner bracket)
 * - LP_STRICT_CMS — page body PATCH requires ContentWorkspace client header
 */

function truthy(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** GitHub Actions, GitLab CI, Vercel, etc. set CI=true — strict control plane is always on there. */
function isCiEnv(): boolean {
  return truthy(process.env.CI);
}

/**
 * Master strict switch: AI + CMS + DS server strict + throws on bypass warnings (not only runAi).
 * Forced on when CI=true so merges cannot ship without the same guarantees as local STRICT_MODE.
 */
export function isStrictMode(): boolean {
  return truthy(process.env.STRICT_MODE) || isCiEnv();
}

export function isStrictControlPlane(): boolean {
  return truthy(process.env.LP_STRICT_CONTROL) || isStrictMode();
}

export function isStrictAi(): boolean {
  return isStrictControlPlane() || truthy(process.env.LP_STRICT_AI) || isStrictMode();
}

export function isStrictCms(): boolean {
  return isStrictControlPlane() || truthy(process.env.LP_STRICT_CMS) || isStrictMode();
}

/** Client + server: NEXT_PUBLIC_LP_STRICT_DS for browser; LP_STRICT_DS for SSR/build checks */
export function isStrictDsServer(): boolean {
  return isStrictControlPlane() || truthy(process.env.LP_STRICT_DS) || isStrictMode();
}
