import type { SalesPoint } from "@/lib/forecast/data";

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export type TrendResult = { dir: "up" | "down" | "flat"; strength: number };

export function trend(points: SalesPoint[]): TrendResult {
  const s = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 6) return { dir: "flat", strength: 0 };
  const last3 = s.slice(-3).reduce((a, b) => a + b.units, 0);
  const prev3 = s.slice(-6, -3).reduce((a, b) => a + b.units, 0);
  if (prev3 === 0) return { dir: "flat", strength: 0 };
  const r = (last3 - prev3) / prev3;
  if (r > 0.15) return { dir: "up", strength: r };
  if (r < -0.15) return { dir: "down", strength: Math.abs(r) };
  return { dir: "flat", strength: Math.abs(r) };
}

export function weekdayIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.getDay(); // 0–6, lokal tid
}

export function weekdayLift(points: SalesPoint[]): Map<number, number> {
  const byDay = new Map<number, number[]>();
  const all: number[] = [];
  for (const p of points) {
    const w = weekdayIndex(p.date);
    const arr = byDay.get(w) ?? [];
    arr.push(p.units);
    byDay.set(w, arr);
    all.push(p.units);
  }
  const overall = avg(all);
  const lift = new Map<number, number>();
  for (const [w, arr] of byDay) {
    lift.set(w, overall ? avg(arr) / overall : 1);
  }
  return lift;
}
