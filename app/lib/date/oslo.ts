// lib/date/oslo.ts

/**
 * =========================================================
 * OSLO DATE HELPERS – SINGLE SOURCE OF TRUTH
 * ---------------------------------------------------------
 * - Europe/Oslo timezone
 * - Ingen eksterne libs
 * - Brukes av UI, API, cron og cutoff-logikk
 * - ISO (YYYY-MM-DD) er intern standard
 * - NO (DD-MM-YYYY) er visningsformat i Norge
 * =========================================================
 */

export const OSLO_TZ = "Europe/Oslo";

export type OsloWeekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type OsloParts = {
  yyyy: string;
  mm: string;
  dd: string;
  weekday: OsloWeekday;
  hh: number;
  mi: number;
  ss: number;
};

/* =========================================================
   KJERNE – NÅTID I OSLO
========================================================= */

/**
 * Nåtid i Oslo – strukturerte deler
 */
export function osloNowParts(): OsloParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
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
    weekday: get("weekday") as OsloWeekday,
    hh: Number(get("hour")),
    mi: Number(get("minute")),
    ss: Number(get("second")),
  };
}

/**
 * ISO-lignende timestamp i Oslo (YYYY-MM-DDTHH:mm:ss)
 * Kun for logging / visning (IKKE lagring)
 */
export function osloNowISO(): string {
  const o = osloNowParts();
  return `${o.yyyy}-${o.mm}-${o.dd}T${String(o.hh).padStart(2, "0")}:${String(o.mi).padStart(
    2,
    "0"
  )}:${String(o.ss).padStart(2, "0")}`;
}

/**
 * UTC ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)
 * Brukes for lagring i Sanity: publishedAt / lockedAt
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/* =========================================================
   DATO – ISO (INTERN)
========================================================= */

/**
 * Dato i Oslo som ISO (YYYY-MM-DD)
 * Brukes til DB, API, cron, cutoff, sortering
 */
export function osloTodayISODate(): string {
  const o = osloNowParts();
  return `${o.yyyy}-${o.mm}-${o.dd}`;
}

/**
 * Mandag (start på uke) for en gitt ISO-dato (YYYY-MM-DD)
 * DST-safe (UTC midt på dagen)
 */
export function startOfWeekISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diffToMon = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMon);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Legg til dager på ISO-dato (YYYY-MM-DD)
 * DST-safe
 */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* =========================================================
   DATO – NO (VISNING)
========================================================= */

/**
 * Dato i Oslo som NO-format (DD-MM-YYYY)
 * Kun UI / visning i Norge
 */
export function osloTodayNODate(): string {
  const o = osloNowParts();
  return `${o.dd}-${o.mm}-${o.yyyy}`;
}

/**
 * ISO → NO (YYYY-MM-DD → DD-MM-YYYY)
 */
export function formatDateNO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * NO → ISO (DD-MM-YYYY → YYYY-MM-DD)
 * Kun hvis input tas i NO-format
 */
export function parseDateNO(no: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(no ?? ""));
  if (!m) return String(no ?? "");
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/* =========================================================
   REGLER
========================================================= */

/**
 * Publiseringsvindu: Torsdag–Søndag (Oslo)
 */
export function isPublishWindowOslo(): boolean {
  const { weekday } = osloNowParts();
  return weekday === "Thu" || weekday === "Fri" || weekday === "Sat" || weekday === "Sun";
}

/**
 * Cutoff-sjekk: etter kl. 08:00 (Oslo)
 */
export function isAfterCutoff0800(): boolean {
  const o = osloNowParts();
  return o.hh > 8 || (o.hh === 8 && (o.mi > 0 || o.ss > 0));
}
