import "server-only";

import type { ControlTowerData } from "@/lib/controlTower/types";
import { listPartners } from "@/lib/partners/registry";
import { networkValueFromCounts } from "@/lib/network/effects";

export type PlatformPowerViewMetrics = {
  network: number;
  data: number;
  partners: number;
  explain: string[];
};

/**
 * Kontrolltårn-proxy for plattformkraft — ikke rå databaseeksport.
 */
export function buildPlatformPowerMetrics(ct: ControlTowerData): PlatformPowerViewMetrics {
  const explain: string[] = [];
  const partners = listPartners().length;

  const companiesProxy = Math.max(1, Math.min(50_000, Math.floor(ct.revenue.ordersCountedWeek / 2) + 1));
  const network = networkValueFromCounts(companiesProxy, partners);

  const dataPoints = ct.ai.decisions24h + ct.revenue.ordersCountedWeek + ct.ai.approved24h;

  explain.push("Nettverksverdi er en indeks (proxy × partnere) — ikke finansiell verdsettelse.");
  explain.push("Datapunkter summerer AI-sykluser og ordreaktivitet (aggregert).");
  explain.push("Partnerregister er additivt og tomt til integrasjoner kobles.");

  return {
    network,
    data: dataPoints,
    partners,
    explain,
  };
}
