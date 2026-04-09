import { num } from "@/lib/finance/numbers";

function monthSpanInclusive(oldest: Date, newest: Date): number {
  const ms = Math.max(0, newest.getTime() - oldest.getTime());
  const days = ms / 86_400_000;
  return Math.max(1, days / 30.4375);
}

export type ARRResult = {
  arr: number;
  monthlyRunRate: number;
  monthsObserved: number;
  explain: string[];
};

/**
 * Årsisert omsetning (ARR) som **run-rate**: total omsetning / observert tidsperiode (måneder) × 12.
 * Forklarbar og reproduserbar — ikke GAAP-regnskap.
 */
export function estimateARR(orders: Array<{ line_total?: unknown; total_amount?: unknown; created_at?: string }>): ARRResult {
  const list = Array.isArray(orders) ? orders : [];
  const total = list.reduce((s, o) => s + num(o.line_total ?? o.total_amount), 0);

  if (total <= 0) {
    return {
      arr: 0,
      monthlyRunRate: 0,
      monthsObserved: 0,
      explain: ["Ingen ordre med beløp — ARR satt til 0 (fail-closed)."],
    };
  }

  const dates: Date[] = [];
  for (const o of list) {
    const raw = o.created_at;
    if (typeof raw === "string" && raw.trim()) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    }
  }

  if (dates.length < 2) {
    return {
      arr: total * 12,
      monthlyRunRate: total,
      monthsObserved: 1,
      explain: [
        "Kun én eller ingen datert ordre — antar beløpet representerer én måned (konservativt) for run-rate.",
        "ARR = månedlig run-rate × 12.",
      ],
    };
  }

  let oldest = dates[0]!;
  let newest = dates[0]!;
  for (const d of dates) {
    if (d < oldest) oldest = d;
    if (d > newest) newest = d;
  }

  const monthsObserved = monthSpanInclusive(oldest, newest);
  const monthlyRunRate = total / monthsObserved;
  const arr = monthlyRunRate * 12;

  return {
    arr,
    monthlyRunRate,
    monthsObserved,
    explain: [
      `Observert periode ≈ ${monthsObserved.toFixed(2)} måneder (fra eldste til nyeste ordredato).`,
      `Månedlig run-rate = total omsetning / måneder observert.`,
      `ARR = månedlig run-rate × 12 (indikator, ikke revidert regnskap).`,
    ],
  };
}
