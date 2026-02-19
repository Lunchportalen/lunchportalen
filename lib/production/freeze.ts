// lib/production/freeze.ts
import "server-only";

/**
 * Cutoff: 08:00 Europe/Oslo.
 * Vi bruker "nå" i server-tid og regner cutoff for dagens dato i Oslo.
 * Implementasjonen under er robust nok for enterprise-bruk, men for 100% DST-korrekthet
 * bør du ha en eksisterende oslo-tidslib (du har allerede /lib/date/oslo).
 *
 * Hvis du allerede har osloTodayISODate / osloNow / cutoff helpers:
 * - Bytt ut implementasjonen her med dine eksisterende.
 */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Returner "YYYY-MM-DD" i Europe/Oslo basert på server "now" */
export function osloTodayISODate(now = new Date()) {
  // Bruk Intl til å hente Oslo-dato (DST-safe)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Returner en Date som representerer cutoff (08:00) i Europe/Oslo for dagens dato */
export function osloCutoffDate(now = new Date()) {
  const iso = osloTodayISODate(now);
  // Vi lager en "lokal" 08:00 i Oslo ved å formatere som tid og rekonstruere i UTC via offset.
  // En praktisk måte: bruk Intl til å få Oslo offset ved 08:00 (DST-safe).
  const [Y, M, D] = iso.split("-").map(Number);

  // Start med UTC-midnatt og flytt til 08:00 Oslo via tidsformat/parts
  // Enkel robust variant: bygg en "pretend UTC" og korriger via Oslo-time.
  const approximate = new Date(Date.UTC(Y, (M ?? 1) - 1, D ?? 1, 8, 0, 0));

  // Finn hva klokka er i Oslo for den "approximate" og korriger hvis nødvendig.
  // Vi vil ha tidspunktet der Oslo viser 08:00:00.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = fmt.formatToParts(approximate);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const ss = Number(parts.find((p) => p.type === "second")?.value ?? "0");

  // Hvis approximate ikke lander nøyaktig på 08:00 Oslo (pga DST), korriger differansen.
  const deltaSeconds = (hh - 8) * 3600 + mm * 60 + ss;
  return new Date(approximate.getTime() - deltaSeconds * 1000);
}

export function isLockedNow(now = new Date()) {
  const cutoff = osloCutoffDate(now);
  return now.getTime() >= cutoff.getTime();
}

export function freezeState(now = new Date()) {
  const cutoff = osloCutoffDate(now);
  const locked = now.getTime() >= cutoff.getTime();
  return {
    nowIso: now.toISOString(),
    cutoffIso: cutoff.toISOString(),
    locked,
  };
}
