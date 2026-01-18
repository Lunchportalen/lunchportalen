// lib/date/format.ts

/**
 * Norden (NO/SE/FI/DK) -> DD-MM-YYYY
 * Resten              -> YYYY-MM-DD
 *
 * Robust: bruker timeZone (Europe/Oslo osv.) i stedet for språk i nettleseren.
 */

const NORDIC_TZ = new Set([
  "Europe/Oslo",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Copenhagen",
]);

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return "";

  // forventer ISO YYYY-MM-DD
  const [yyyy, mm, dd] = isoDate.split("-");
  if (!yyyy || !mm || !dd) return isoDate;

  const tz = getBrowserTimeZone();
  const isNordic = NORDIC_TZ.has(tz);

  return isNordic ? `${dd}-${mm}-${yyyy}` : `${yyyy}-${mm}-${dd}`;
}
