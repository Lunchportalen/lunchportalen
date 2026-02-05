// lib/date/format.ts
// UI-formattering (NO): alltid DD-MM-YYYY, backend beholder ISO.

const OSLO_TZ = "Europe/Oslo";

function normalizeDatePart(input: string): { yyyy: string; mm: string; dd: string } | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const datePart = s.includes("T") ? s.split("T")[0] : s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  return { yyyy: m[1], mm: m[2], dd: m[3] };
}

function toOsloParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    yyyy: get("year"),
    mm: get("month"),
    dd: get("day"),
    hh: get("hour"),
    mi: get("minute"),
    ss: get("second"),
  };
}

export function formatDateNO(isoYYYYMMDD: string): string {
  const parts = normalizeDatePart(isoYYYYMMDD);
  if (!parts) return String(isoYYYYMMDD ?? "");
  return `${parts.dd}-${parts.mm}-${parts.yyyy}`;
}

export function formatDateISO(isoYYYYMMDD: string): string {
  const parts = normalizeDatePart(isoYYYYMMDD);
  if (!parts) return String(isoYYYYMMDD ?? "");
  return `${parts.yyyy}-${parts.mm}-${parts.dd}`;
}

export function formatDateTimeNO(isoDatetime: string): string {
  if (!isoDatetime) return "";
  const d = new Date(isoDatetime);
  if (Number.isNaN(d.getTime())) return String(isoDatetime ?? "");
  const p = toOsloParts(d);
  return `${p.dd}-${p.mm}-${p.yyyy} ${p.hh}:${p.mi}`;
}

const WEEKDAYS_NO = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS_NO_SHORT = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

function parseDateLike(input: string): Date | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(`${s}-01T12:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatWeekdayNO(isoYYYYMMDD: string): string {
  const parts = normalizeDatePart(isoYYYYMMDD);
  if (!parts) return "";
  const d = new Date(`${parts.yyyy}-${parts.mm}-${parts.dd}T12:00:00Z`);
  const idx = d.getUTCDay();
  return WEEKDAYS_NO[idx] ?? "";
}

export function formatDayMonthShortNO(isoYYYYMMDD: string): string {
  const parts = normalizeDatePart(isoYYYYMMDD);
  if (!parts) return String(isoYYYYMMDD ?? "");
  const monthIdx = Math.max(0, Math.min(11, Number(parts.mm) - 1));
  return `${parts.dd}. ${MONTHS_NO_SHORT[monthIdx]}`;
}

export function formatTimeNO(isoDatetime: string): string {
  if (!isoDatetime) return "";
  const d = new Date(isoDatetime);
  if (Number.isNaN(d.getTime())) return "";
  const p = toOsloParts(d);
  return `${p.hh}:${p.mi}`;
}

export function formatDateTimeSecondsNO(isoDatetime: string): string {
  if (!isoDatetime) return "";
  const d = new Date(isoDatetime);
  if (Number.isNaN(d.getTime())) return String(isoDatetime ?? "");
  const p = toOsloParts(d);
  return `${p.dd}-${p.mm}-${p.yyyy} ${p.hh}:${p.mi}:${p.ss}`;
}

export function formatMonthYearShortNO(input: string): string {
  const d = parseDateLike(input);
  if (!d) return String(input ?? "");
  return new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO_TZ, month: "short", year: "numeric" }).format(d);
}

export function formatMonthYearLongNO(input: string): string {
  const d = parseDateLike(input);
  if (!d) return String(input ?? "");
  return new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO_TZ, month: "long", year: "numeric" }).format(d);
}
