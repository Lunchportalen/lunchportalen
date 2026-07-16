// lib/invites/employeeInviteConstants.ts
// ONE canonical invitation TTL policy (Fase 3). Every invite creation and
// resend path (employee + company-admin) derives expiry from here so tokens
// never diverge (previously 48h in the single-invite path vs 7d elsewhere).

/** Canonical invitation lifetime: 7 days. */
export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * INVITE_TTL_DAYS;

/** Back-compat alias — same single policy. */
export const EMPLOYEE_INVITE_TTL_MS = INVITE_TTL_MS;

/** Canonical `expires_at` ISO for a newly created/rotated invite. */
export function inviteExpiresAtIso(from: number = Date.now()): string {
  return new Date(from + INVITE_TTL_MS).toISOString();
}
