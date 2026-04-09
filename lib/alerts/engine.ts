/**
 * Kjører alle regelbaserte sjekker (deterministisk, ren funksjon bortsett fra UUID).
 */

import { randomUUID } from "node:crypto";

import type { Alert, AlertSeed, FinancialAlertRunInput } from "@/lib/alerts/types";
import {
  detectHighSpendLowReturn,
  detectNoRevenue,
  detectProfitDrop,
  detectRevenueDayDropProxy,
  detectRoasDrop,
  detectSuddenSpike,
  detectWinner,
} from "@/lib/alerts/detectors";

function revenueGrowth(today: number, yesterday: number): number | null {
  if (!yesterday || yesterday <= 0) return null;
  return (today - yesterday) / yesterday;
}

export function runAlertChecks(data: FinancialAlertRunInput): Alert[] {
  if (!data.dataTrusted) {
    return [];
  }

  const alerts: Alert[] = [];
  const seeds: Array<AlertSeed | null> = [];

  const pg = revenueGrowth(data.revenueToday, data.revenueYesterday);

  if (data.profitToday != null && data.profitYesterday != null) {
    seeds.push(detectProfitDrop(data.profitToday, data.profitYesterday));
  } else {
    seeds.push(detectRevenueDayDropProxy(data.revenueToday, data.revenueYesterday));
  }

  seeds.push(detectNoRevenue(data));
  if (data.adSpendKnown) {
    seeds.push(detectHighSpendLowReturn(data.adSpend, data.revenueToday));
  }
  if (pg != null) {
    seeds.push(detectWinner(pg));
  }
  seeds.push(detectRoasDrop(data.roasCurrent, data.roasPrevious));
  seeds.push(detectSuddenSpike(data.revenueToday, data.revenueYesterday));

  for (const s of seeds) {
    if (!s) continue;
    const full: Alert = {
      id: randomUUID(),
      ...s,
      timestamp: Date.now(),
    };
    alerts.push(full);
  }

  return alerts;
}
