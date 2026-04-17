/** Ren presentasjonsoppdeling av vindusdager mot Oslo «i dag» — ingen ny ordresemantikk. */

export type WindowDayLike = {
  date?: unknown;
  weekday?: unknown;
  isLocked?: unknown;
  isEnabled?: unknown;
  lockReason?: unknown;
  wantsLunch?: unknown;
  orderStatus?: unknown;
  lastSavedAt?: unknown;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * API-et for vindu returnerer typisk kun datoer ≥ i dag. Dager eldre enn i dag skal normalt ikke forekomme.
 * «I dag» og «kommende» skilles for tydelig visning.
 */
export function partitionWindowDaysForSummary(
  days: WindowDayLike[],
  todayIso: string,
): { today: WindowDayLike[]; upcoming: WindowDayLike[] } {
  const today: WindowDayLike[] = [];
  const upcoming: WindowDayLike[] = [];

  for (const d of days) {
    const date = safeStr(d.date);
    if (!date) continue;
    if (date === todayIso) today.push(d);
    else if (date > todayIso) upcoming.push(d);
  }

  upcoming.sort((a, b) => safeStr(a.date).localeCompare(safeStr(b.date)));

  return { today, upcoming };
}
