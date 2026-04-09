/**
 * Superadmin SoMe-autonomi — av som standard; ingen auto-publisering med mindre eksplisitt slått på.
 * Overstyr med miljøvariabel `SOCIAL_AUTONOMY_ENABLED=true` (server-only).
 */
function envBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return undefined;
}

export const autonomyConfig = {
  get enabled(): boolean {
    return envBool(process.env.SOCIAL_AUTONOMY_ENABLED) ?? false;
  },
  maxPostsPerDay: 3,
  maxActionsPerRun: 5,
  allowAutoPublish: false,
};
