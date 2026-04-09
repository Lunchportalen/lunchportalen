/**
 * Bygg salgspunkter fra kalender (registrerte konverterings-/lead-signaler per dag og produkt).
 * Ingen antatte enheter utover det som finnes i performance-feltene.
 */

import type { CalendarPost } from "@/lib/social/calendar";
import type { SalesPoint } from "@/lib/forecast/data";

function intUnits(n: unknown): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.floor(x));
}

export function salesPointsFromCalendarPosts(posts: CalendarPost[]): SalesPoint[] {
  const acc = new Map<string, number>();
  for (const p of posts) {
    if (p.status === "cancelled") continue;
    const day = String(p.slotDay ?? "").trim();
    const pid = String(p.productId ?? "").trim();
    if (!day || !pid) continue;
    const perf = p.performance;
    if (!perf) continue;
    const units =
      intUnits(perf.conversions) +
      intUnits(perf.imageConversions) +
      intUnits(perf.videoAttributedConversions) +
      intUnits(perf.leads);
    const key = `${pid}\t${day}`;
    acc.set(key, (acc.get(key) ?? 0) + units);
  }
  const out: SalesPoint[] = [];
  for (const [key, u] of acc) {
    const [productId, date] = key.split("\t");
    out.push({ productId, date, units: u });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
