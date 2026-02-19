import "server-only";

export const OSLO_TIMEZONE = "Europe/Oslo";

type OsloParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function osloParts(now: Date = new Date()): OsloParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function osloCurrentPeriodYm(now: Date = new Date()): string {
  const p = osloParts(now);
  return `${p.year}-${p.month}`;
}

export function osloPreviousPeriodYm(now: Date = new Date()): string {
  const current = osloCurrentPeriodYm(now);
  const [yearRaw, monthRaw] = current.split("-");

  let year = Number(yearRaw);
  let month = Number(monthRaw) - 1;

  if (month <= 0) {
    year -= 1;
    month = 12;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function osloNowIsoLocal(now: Date = new Date()): string {
  const p = osloParts(now);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
