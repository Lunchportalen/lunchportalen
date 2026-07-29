/**
 * Single source of truth for the owner-approved isolated Phase 18 load-cert project.
 * Never production. Never shared staging.
 */
export const PROD_REF = "hkpokyapzarefrgqzkos";
export const STAGING_REF = "uigxsboqeruxflgzqztl";

/** Current owner-approved isolated project (created 2026-07-29, 72h lifetime). */
export const LOADCERT_REF = "lenajhsfrqdqcdzhcuao";

export function approvedLoadCertRef(env = process.env) {
  const fromEnv = String(env.PHASE18_APPROVED_LOAD_REF || env.PHASE18_LOAD_REF || LOADCERT_REF).trim();
  if (!fromEnv) return LOADCERT_REF;
  if (fromEnv === PROD_REF || fromEnv === STAGING_REF) {
    throw new Error(`FORBIDDEN_LOADCERT_REF: ${fromEnv}`);
  }
  return fromEnv;
}

export function assertNotForbiddenRef(ref) {
  const r = String(ref || "").trim();
  if (!r) throw new Error("PHASE18_LOAD_REF_REQUIRED");
  if (r === PROD_REF || r === STAGING_REF) throw new Error(`FORBIDDEN_REF: ${r}`);
  return r;
}
