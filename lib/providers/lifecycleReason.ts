/** Minimum reason length enforced by RPC (private.lp_lifecycle_require_reason). */
export const LIFECYCLE_REASON_MIN_LENGTH = 20;

export function validateLifecycleReason(reason: unknown): string | null {
  const t = String(reason ?? "").trim();
  if (t.length < LIFECYCLE_REASON_MIN_LENGTH) {
    return `Begrunnelse må være minst ${LIFECYCLE_REASON_MIN_LENGTH} tegn.`;
  }
  return null;
}
