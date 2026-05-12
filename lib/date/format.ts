// lib/date/format.ts
// UI-formattering (NO): alltid dd.MM.yyyy, backend beholder ISO.

const OSLO_TZ = "Europe/Oslo";
const MENU_WEEKDAYS_NO = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

type DateInput = string | Date | null | undefined;
type OsloDateParts = { yyyy: string; mm: string; dd: string };
type OsloDateTimeParts = OsloDateParts & { hh: string; mi: string; ss: string };

function normalizeDatePart(input: string): OsloDateParts | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const datePart = s.includes("T") ? s.split("T")[0] : s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  const yyyy = m[1];
  const mm = m[2];
  const dd = m[3];
  const localDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (
    localDate.getFullYear() !== Number(yyyy) ||
    localDate.getMonth() !== Number(mm) - 1 ||
    localDate.getDate() !== Number(dd)
  ) {
    return null;
  }
  return { yyyy, mm, dd };
}

function isDateOnlyString(input: unknown): input is string {
  return typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim());
}

function toOsloParts(d: Date): OsloDateTimeParts | null {
  if (Number.isNaN(d.getTime())) return null;
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

function datePartsForDisplay(input: DateInput): OsloDateParts | null {
  if (input == null) return null;
  if (input instanceof Date) return toOsloParts(input);

  const s = String(input).trim();
  if (!s) return null;
  if (isDateOnlyString(s)) return normalizeDatePart(s);

  const d = new Date(s);
  return toOsloParts(d);
}

function dateTimePartsForDisplay(input: DateInput): OsloDateTimeParts | null {
  if (input == null) return null;
  if (input instanceof Date) return toOsloParts(input);

  const s = String(input).trim();
  if (!s) return null;
  if (isDateOnlyString(s)) {
    const parts = normalizeDatePart(s);
    return parts ? { ...parts, hh: "00", mi: "00", ss: "00" } : null;
  }

  const d = new Date(s);
  return toOsloParts(d);
}

function weekdayIndexFromParts(parts: OsloDateParts): number {
  return new Date(Number(parts.yyyy), Number(parts.mm) - 1, Number(parts.dd)).getDay();
}

export function formatDateNO(value: DateInput): string {
  const parts = datePartsForDisplay(value);
  if (!parts) return "";
  return `${parts.dd}.${parts.mm}.${parts.yyyy}`;
}

export function formatDateISO(isoYYYYMMDD: string): string {
  const parts = normalizeDatePart(isoYYYYMMDD);
  if (!parts) return String(isoYYYYMMDD ?? "");
  return `${parts.yyyy}-${parts.mm}-${parts.dd}`;
}

export function formatDateTimeNO(value: DateInput): string {
  const p = dateTimePartsForDisplay(value);
  if (!p) return "";
  return `${p.dd}.${p.mm}.${p.yyyy} ${p.hh}:${p.mi}`;
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
  if (!p) return "";
  return `${p.hh}:${p.mi}`;
}

export function formatDateTimeSecondsNO(value: DateInput): string {
  const p = dateTimePartsForDisplay(value);
  if (!p) return "";
  return `${p.dd}.${p.mm}.${p.yyyy} ${p.hh}:${p.mi}:${p.ss}`;
}

export function formatMenuDateNO(value: DateInput): string {
  const parts = datePartsForDisplay(value);
  if (!parts) return "";
  const weekday = MENU_WEEKDAYS_NO[weekdayIndexFromParts(parts)] ?? "";
  return weekday ? `${weekday} ${parts.dd}.${parts.mm}.${parts.yyyy}` : "";
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
