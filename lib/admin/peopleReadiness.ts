/** UI-only readiness phase for /admin/people (no backend). */

export type PeopleReadinessPhase = "empty" | "pending_invite" | "active_employees";

export function resolvePeopleReadinessPhase(opts: {
  activeEmployeeCount: number;
  pendingInviteCount: number;
}): PeopleReadinessPhase {
  if (opts.activeEmployeeCount > 0) return "active_employees";
  if (opts.pendingInviteCount > 0) return "pending_invite";
  return "empty";
}

export function isPendingEmployeeInvite(invite: {
  used_at: string | null;
  expires_at: string | null;
}): boolean {
  if (invite.used_at) return false;
  const exp = invite.expires_at ? new Date(invite.expires_at).getTime() : NaN;
  if (Number.isFinite(exp) && Date.now() > exp) return false;
  return true;
}
