/**
 * WS-3 — week-opening notification timing + event keys (Oslo, pure).
 */

import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { getVisibleWindow, osloParts, hhmmToMin } from "@/lib/week/availability";

export const MENU_WEEK_OPENING_CHANNEL_EMAIL = "email" as const;

export function weekOpeningThirdWeekMonday(now: Date): string {
  const todayIso = osloTodayISODate();
  const thisWeekMonday = startOfWeekISO(todayIso);
  return addDaysISO(thisWeekMonday, 14);
}

/** Cron window: Thursday 14:00–14:09 Oslo (uke-åpning). */
export function isMenuWeekOpeningNotifyWindow(now: Date): boolean {
  const p = osloParts(now);
  if (p.weekday !== 4) return false;
  const minutes = hhmmToMin(p);
  return minutes >= 14 * 60 && minutes < 14 * 60 + 10;
}

/** Fail-closed: only send when third week is in employee window. */
export function shouldRunMenuWeekOpeningNotify(now: Date): boolean {
  if (!isMenuWeekOpeningNotifyWindow(now)) return false;
  return getVisibleWindow(now).showThird;
}

export function weekOpeningEventKey(now: Date): string {
  return weekOpeningThirdWeekMonday(now);
}

export function formatWeekRangeNo(mondayIso: string): string {
  const friIso = addDaysISO(mondayIso, 4);
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}`;
  };
  return `${fmt(mondayIso)}–${fmt(friIso)}`;
}

export function menuWeekOpeningEnabledFromPref(raw: boolean | null | undefined): boolean {
  return raw !== false;
}

export type MenuWeekOpeningRecipient = {
  userId: string;
  email: string;
  companyId: string;
};

export function filterRecipientsForSend(
  recipients: MenuWeekOpeningRecipient[],
  prefs: Map<string, boolean | null>,
  alreadySentUserIds: Set<string>,
): { toSend: MenuWeekOpeningRecipient[]; skippedOptOut: number; skippedAlready: number } {
  const toSend: MenuWeekOpeningRecipient[] = [];
  let skippedOptOut = 0;
  let skippedAlready = 0;

  for (const r of recipients) {
    if (alreadySentUserIds.has(r.userId)) {
      skippedAlready += 1;
      continue;
    }
    const enabled = menuWeekOpeningEnabledFromPref(prefs.get(r.userId));
    if (!enabled) {
      skippedOptOut += 1;
      continue;
    }
    toSend.push(r);
  }

  return { toSend, skippedOptOut, skippedAlready };
}
