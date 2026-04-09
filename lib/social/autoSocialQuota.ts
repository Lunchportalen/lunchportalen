/**
 * Klient-side dagskvote for trygg auto-publisering (kun når bruker har slått på modus).
 * Ingen skjulte sideeffekter uten eksplisitt toggle.
 */

const KEY_ENABLED = "lp_social_auto_user_enabled";
const KEY_DAY = "lp_social_auto_day";
const KEY_COUNT = "lp_social_auto_count";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAutoSocialUserEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY_ENABLED) === "1";
}

export function setAutoSocialUserEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ENABLED, on ? "1" : "0");
}

/** Maks antall auto-innlegg per kalenderdag (produktposter, lav risiko). */
export function canAutoSocialPostToday(maxPerDay: number): boolean {
  if (typeof window === "undefined") return false;
  const d = todayKey();
  const storedDay = window.localStorage.getItem(KEY_DAY);
  const countRaw = window.localStorage.getItem(KEY_COUNT);
  const count = storedDay === d ? Math.max(0, parseInt(countRaw ?? "0", 10) || 0) : 0;
  return count < maxPerDay;
}

export function incrementAutoSocialPostToday(): void {
  if (typeof window === "undefined") return;
  const d = todayKey();
  const storedDay = window.localStorage.getItem(KEY_DAY);
  const count = storedDay === d ? Math.max(0, parseInt(window.localStorage.getItem(KEY_COUNT) ?? "0", 10) || 0) : 0;
  window.localStorage.setItem(KEY_DAY, d);
  window.localStorage.setItem(KEY_COUNT, String(count + 1));
}

export function getAutoSocialCountToday(): number {
  if (typeof window === "undefined") return 0;
  const d = todayKey();
  const storedDay = window.localStorage.getItem(KEY_DAY);
  if (storedDay !== d) return 0;
  return Math.max(0, parseInt(window.localStorage.getItem(KEY_COUNT) ?? "0", 10) || 0);
}
