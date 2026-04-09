/**
 * Klient-lagring for kalender (delt nøkkel for lesing i AI CEO m.m.).
 */

import { parseCalendar, type CalendarPost } from "@/lib/social/calendar";

export const CALENDAR_STORAGE_PREFIX = "lp_social_calendar_v2_";

export function calendarStorageKey(pageId: string): string {
  return `${CALENDAR_STORAGE_PREFIX}${pageId || "default"}`;
}

export function readCalendarPostsFromLocalStorage(pageId: string): CalendarPost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(calendarStorageKey(pageId));
    return parseCalendar(raw ?? "[]");
  } catch {
    return [];
  }
}
