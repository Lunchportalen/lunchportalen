/**
 * Safe feature / kill-switch checks for client or server (loose row shape).
 * Use with data from getSettings(), API json.data, or useSettings().
 */
export function isFeatureEnabled(settings: unknown, key: string): boolean {
  if (!settings || typeof settings !== "object") return false;
  const t = (settings as { toggles?: Record<string, unknown> }).toggles;
  return t?.[key] === true;
}

export function isKilled(settings: unknown, key: string): boolean {
  if (!settings || typeof settings !== "object") return false;
  const k = (settings as { killswitch?: Record<string, unknown> }).killswitch;
  return k?.[key] === true;
}
