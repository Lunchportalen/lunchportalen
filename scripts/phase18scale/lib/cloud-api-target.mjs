/**
 * Validate Phase 18SCALE API/runtime URL for cloud load-cert mode.
 * Localhost required for local mode; isolated project required for PHASE18_LOADCERT=1.
 */
import { PROD_REF, STAGING_REF } from "../load-env.mjs";

const LOADCERT_REF = "arstaxredytrjcmqcwhh";

export function isLoadCertMode(env = process.env) {
  return ["1", "true", "yes"].includes(String(env.PHASE18_LOADCERT || "").toLowerCase());
}

export function assertPhase18ApiTarget(url, env = process.env) {
  const u = String(url || "").replace(/\/$/, "");
  if (!u) throw new Error("PHASE18_API_URL_MISSING");
  if (u.includes(PROD_REF) || /app\.lunchportalen\.no/i.test(u)) {
    throw new Error("PRODUCTION_API_TARGET_FORBIDDEN");
  }
  if (u.includes(STAGING_REF)) throw new Error("SHARED_STAGING_API_TARGET_FORBIDDEN");

  const local = /127\.0\.0\.1|localhost|0\.0\.0\.0|:54321/i.test(u);
  if (isLoadCertMode(env)) {
    const ref = String(env.PHASE18_LOAD_REF || "").trim();
    if (ref !== LOADCERT_REF) {
      throw new Error(`CLOUD_API_TARGET_REF_FORBIDDEN: expected ${LOADCERT_REF} got ${ref || "empty"}`);
    }
    if (local) throw new Error("CLOUD_API_TARGET_LOCALHOST_FORBIDDEN");
    if (!u.includes(`${LOADCERT_REF}.supabase.co`)) {
      throw new Error(`CLOUD_API_TARGET_HOST_MISMATCH: ${u}`);
    }
    return { mode: "cloud", ref: LOADCERT_REF, url: u };
  }

  if (!local) {
    throw new Error(`PHASE18_API_NON_LOCAL_FORBIDDEN: ${u}`);
  }
  return { mode: "local", ref: null, url: u };
}
