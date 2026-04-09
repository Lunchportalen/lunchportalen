// STATUS: KEEP

import "server-only";

import { sanity } from "@/lib/sanity/client";
import type { CmsWeekTemplate } from "@/lib/cms/types";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

const DAY_KEYS: WeekdayKeyMonFri[] = ["mon", "tue", "wed", "thu", "fri"];

export async function getWeekTemplate(name: string): Promise<CmsWeekTemplate | null> {
  const key = String(name ?? "").trim();
  if (!key) return null;
  try {
    const doc = await sanity.fetch(
      `*[_type == "weekTemplate" && name == $name][0]{ name, days }`,
      { name: key }
    );
    if (!doc || typeof doc !== "object") return null;
    const n = String((doc as any).name ?? "").trim();
    if (!n) return null;
    const rawDays = (doc as any).days && typeof (doc as any).days === "object" ? (doc as any).days : {};
    const days: Partial<Record<WeekdayKeyMonFri, string>> = {};
    for (const d of DAY_KEYS) {
      const v = (rawDays as any)[d];
      if (v == null || String(v).trim() === "") continue;
      const nk = normalizeMealTypeKey(v);
      if (nk) days[d] = nk;
    }
    return { name: n, days };
  } catch (e: any) {
    console.warn("[cms/getWeekTemplate] fetch failed", { name: key, detail: String(e?.message ?? e) });
    return null;
  }
}
