// lib/agreements/deliveryDays.ts
import { DAY_KEYS, type DayKey } from "@/lib/agreements/normalize";

export type DeliveryDaysNorm = {
  days: DayKey[];
  unknown: string[];
  raw: any;
};

const CANONICAL_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

const DAY_ALIASES: Record<string, DayKey> = {
  mon: "mon",
  monday: "mon",
  man: "mon",
  mandag: "mon",
  tue: "tue",
  tues: "tue",
  tuesday: "tue",
  tir: "tue",
  tirsdag: "tue",
  wed: "wed",
  weds: "wed",
  wednesday: "wed",
  ons: "wed",
  onsdag: "wed",
  thu: "thu",
  thur: "thu",
  thurs: "thu",
  thursday: "thu",
  tor: "thu",
  torsdag: "thu",
  fri: "fri",
  friday: "fri",
  fre: "fri",
  fredag: "fri",
};

function normalizeToken(v: any): DayKey | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if ((DAY_KEYS as readonly string[]).includes(s)) return s as DayKey;
  return DAY_ALIASES[s] ?? null;
}

function normalizeArray(arr: any[], unknown: string[]) {
  const set = new Set<DayKey>();
  for (const x of arr) {
    const key = normalizeToken(x);
    if (key) {
      set.add(key);
    } else {
      const raw = String(x ?? "").trim();
      if (raw) unknown.push(raw);
    }
  }
  return set;
}

export function normalizeDeliveryDaysStrict(raw: any): DeliveryDaysNorm {
  const unknown: string[] = [];

  if (raw == null) {
    return { days: [], unknown: ["__missing__"], raw };
  }

  if (Array.isArray(raw)) {
    const set = normalizeArray(raw, unknown);
    return { days: CANONICAL_ORDER.filter((d) => set.has(d)), unknown, raw };
  }

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return { days: [], unknown: ["__missing__"], raw };

    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        const set = normalizeArray(parsed, unknown);
        return { days: CANONICAL_ORDER.filter((d) => set.has(d)), unknown, raw };
      }
    } catch {
      // fall through to CSV/space parsing
    }

    const parts = s
      .split(/[,\s]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
    const set = normalizeArray(parts, unknown);
    return { days: CANONICAL_ORDER.filter((d) => set.has(d)), unknown, raw };
  }

  if (typeof raw === "object") {
    const keys = Object.keys(raw).map((k) => k.trim());
    const set = normalizeArray(keys, unknown);
    return { days: CANONICAL_ORDER.filter((d) => set.has(d)), unknown, raw };
  }

  return { days: [], unknown: ["__unknown_type__"], raw };
}
