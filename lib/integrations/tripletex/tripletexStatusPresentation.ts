/**
 * Norwegian labels and date formatting for Tripletex connection dashboard (TPT-B-7c).
 */

const ACTIVITY_LABELS: Record<string, string> = {
  tripletex_onboarding_connection_started: "Tilkobling startet",
  tripletex_onboarding_provisioning_completed: "Oppsett fullført",
  tripletex_onboarding_customer_skipped: "Kunde hoppet over",
  tripletex_onboarding_finalized: "Tilkobling fullført",
  tripletex_onboarding_disconnected: "Tripletex frakoblet",
  tripletex_onboarding_reconnect_initiated: "Gjenoppretting startet",
  tripletex_onboarding_test_token: "Tilkobling testet",
  tripletex_onboarding_vault_purged: "Credentials slettet",
};

const STATE_LABELS: Record<string, string> = {
  CONNECTED: "Tilkoblet",
  CONFIGURING: "Konfigurerer…",
  DEGRADED: "Trenger oppmerksomhet",
  DISCONNECTED: "Frakoblet",
  NOT_CONNECTED: "Ikke tilkoblet",
};

export function tripletexConnectionStateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}

export function tripletexActivityLabel(
  action: string,
  metadata?: Record<string, unknown> | null,
): string {
  const key = String(action ?? "").trim();
  if (key === "tripletex_connection_state_change") {
    const next = String(metadata?.new_state ?? "").trim();
    if (next === "CONNECTED") return "Status endret til tilkoblet";
    if (next === "DEGRADED") return "Status endret til trenger oppmerksomhet";
    if (next === "DISCONNECTED") return "Status endret til frakoblet";
    if (next === "CONFIGURING") return "Status endret til konfigurerer";
    return "Tilkoblingsstatus endret";
  }
  return ACTIVITY_LABELS[key] ?? key.replace(/^tripletex_/, "").replace(/_/g, " ");
}

export function formatTripletexDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(d);
}

export function formatTripletexRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "nå nettopp";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min siden`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `${hours} t siden`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} d siden`;
  return formatTripletexDateTime(iso);
}
