// lib/date/oslo.ts

/**
 * =========================================================
 * OSLO DATE HELPERS – SINGLE SOURCE OF TRUTH
 * ---------------------------------------------------------
 * - Europe/Oslo timezone
 * - Ingen eksterne libs
 * - Brukes av UI, API, cron og cutoff-logikk
 * =========================================================
 */

type OsloParts = {
  yyyy: string;
  mm: string;
  dd: string;
  weekday: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  hh: number;
  mi: number;
  ss: number;
};

/**
 * Nåtid i Oslo – strukturerte deler
 */
export function osloNowParts(): OsloParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  return {
    yyyy: get("year"),
    mm: get("month"),
    dd: get("day"),
    weekday: get("weekday") as OsloParts["weekday"],
    hh: Number(get("hour")),
    mi: Number(get("minute")),
    ss: Number(get("second")),
  };
}

/**
 * ISO-lignende timestamp i Oslo (YYYY-MM-DDTHH:mm:ss)
 * Brukes til logging / visning
 */
export function osloNowISO(): string {
  const o = osloNowParts();
  return `${o.yyyy}-${o.mm}-${o.dd}T${String(o.hh).padStart(2, "0")}:${String(o.mi).padStart(
    2,
    "0"
  )}:${String(o.ss).padStart(2, "0")}`;
}

/**
 * Dato i Oslo som YYYY-MM-DD
 * Brukes til DB-feltet `date`
 */
export function osloTodayISODate(): string {
  const o = osloNowParts();
  return `${o.yyyy}-${o.mm}-${o.dd}`;
}

/**
 * Mandag (start på uke) for en gitt Oslo-dato (YYYY-MM-DD)
 */
export function startOfWeekISO(osloISO: string): string {
  // Bruk midt på dagen for å unngå DST-kanter
  const d = new Date(`${osloISO}T12:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun ... 1=Mon ... 6=Sat
  const diffToMon = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMon);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Legg til dager på en ISO-dato (YYYY-MM-DD) – DST-safe
 */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
