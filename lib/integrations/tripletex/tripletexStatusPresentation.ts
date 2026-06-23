/**
 * i18n key references and date formatting for Tripletex connection dashboard (TPT-B-7c).
 * Display labels resolve client-side via provider.tripletex.state / provider.tripletex.activity.
 */

export const TRIPLETEX_CONNECTION_STATES = [
  "CONNECTED",
  "CONFIGURING",
  "DEGRADED",
  "DISCONNECTED",
  "NOT_CONNECTED",
] as const;

export type TripletexConnectionState = (typeof TRIPLETEX_CONNECTION_STATES)[number];

export const TRIPLETEX_ACTIVITY_ACTION_KEYS: Record<string, string> = {
  tripletex_onboarding_connection_started: "onboarding_connection_started",
  tripletex_onboarding_provisioning_completed: "onboarding_provisioning_completed",
  tripletex_onboarding_customer_skipped: "onboarding_customer_skipped",
  tripletex_onboarding_finalized: "onboarding_finalized",
  tripletex_onboarding_disconnected: "onboarding_disconnected",
  tripletex_onboarding_reconnect_initiated: "onboarding_reconnect_initiated",
  tripletex_onboarding_test_token: "onboarding_test_token",
  tripletex_onboarding_vault_purged: "onboarding_vault_purged",
};

const STATE_CHANGE_KEYS: Record<string, string> = {
  CONNECTED: "state_change_connected",
  DEGRADED: "state_change_degraded",
  DISCONNECTED: "state_change_disconnected",
  CONFIGURING: "state_change_configuring",
};

export function isTripletexConnectionState(value: string): value is TripletexConnectionState {
  return (TRIPLETEX_CONNECTION_STATES as readonly string[]).includes(value);
}

export function resolveTripletexConnectionStateLabel(
  t: (key: TripletexConnectionState) => string,
  state: string,
): string {
  if (isTripletexConnectionState(state)) return t(state);
  return state;
}

export function resolveTripletexActivityLabel(
  t: (key: string) => string,
  action: string,
  metadata?: Record<string, unknown> | null,
): string {
  const key = String(action ?? "").trim();
  if (key === "tripletex_connection_state_change") {
    const next = String(metadata?.new_state ?? "").trim();
    const stateKey = STATE_CHANGE_KEYS[next];
    if (stateKey) return t(stateKey);
    return t("state_change_generic");
  }
  const activityKey = TRIPLETEX_ACTIVITY_ACTION_KEYS[key];
  if (activityKey) return t(activityKey);
  return key.replace(/^tripletex_/, "").replace(/_/g, " ");
}

function dateLocale(locale: string): string {
  return locale === "nb" ? "nb-NO" : "en-GB";
}

export function formatTripletexDateTime(
  iso: string | null | undefined,
  locale: string,
  emDash = "—",
): string {
  if (!iso) return emDash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return emDash;
  return new Intl.DateTimeFormat(dateLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(d);
}

export function formatTripletexRelative(
  iso: string | null | undefined,
  locale: string,
  emDash = "—",
): string {
  if (!iso) return emDash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return emDash;

  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(dateLocale(locale), { numeric: "auto" });
  if (sec < 45) return rtf.format(0, "second");
  const min = Math.floor(sec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hours = Math.floor(min / 60);
  if (hours < 48) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 14) return rtf.format(-days, "day");
  return formatTripletexDateTime(iso, locale, emDash);
}
