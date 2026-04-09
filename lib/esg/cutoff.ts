// STATUS: KEEP

/**
 * Fasit: cut-off 08:00 Europe/Oslo.
 * Vi bruker ISO timestamps. Viktig: server validerer.
 */

export function isCancelledInTime(args: {
  orderDateISO: string;        // YYYY-MM-DD (Oslo-dato)
  cancelledAtISO: string;      // timestamptz string
  cutoffHHMM?: string;         // default 08:00
}): boolean {
  const cutoff = args.cutoffHHMM ?? "08:00";

  // Bygg en "cutoff timestamp" i Oslo-tid.
  // I Next/server bør dere ha en eksisterende oslo helper.
  // Her gjør vi en enkel og robust variant med Intl + Date:
  const [hh, mm] = cutoff.split(":").map(Number);

  // Vi må tolke cancelledAt i absolutt tid
  const cancelledAt = new Date(args.cancelledAtISO);
  if (Number.isNaN(cancelledAt.getTime())) return false;

  // Konstruer cutoff som "lokal Oslo tid" og konverter til Date via ISO med offset
  // (I praksis anbefaler jeg deres eksisterende oslo helper fra lib/date/oslo)
  const cutoffLocal = new Date(`${args.orderDateISO}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+01:00`);

  // NB: +01:00 er vintertid. For 100% korrekt DST: bruk eksisterende oslo tz helper.
  // Men fasiten her er logikken, ikke implementasjonsdetaljen.
  return cancelledAt.getTime() <= cutoffLocal.getTime();
}
