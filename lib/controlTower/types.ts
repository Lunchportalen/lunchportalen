/**
 * Control Tower — serialiserbar snapshot for superadmin-dashboard (ingen hemmeligheter).
 */

import type { ControlTowerFinancialAlerts } from "@/lib/alerts/types";
import type { PL } from "@/lib/finance/pl";
import type { UnitEconomics } from "@/lib/finance/unit";

export type ControlTowerHealthLevel = "ok" | "warning" | "critical";

/** P&L og enhetsøkonomikk for ukesnitt (fail-closed der kost/spend mangler). */
export type ControlTowerFinanceWeek = {
  pl: PL;
  inputs: {
    revenue: number;
    costOfGoods: number;
    adSpend: number;
  };
  /** True når varekost er summert fra kjente ordre→produkt-kost (ikke aktiv i v1-aggregat). */
  cogsKnown: boolean;
  /** True når annonsespend er hentet fra kampanjekilde (ikke aktiv i v1-aggregat). */
  adSpendKnown: boolean;
  explainNb: string[];
  unitEconomics: UnitEconomics[];
};

export type ControlTowerData = {
  generatedAt: string;
  cacheTtlSeconds: number;
  /** Finansvarsler (regelbasert, med kjøling og logg). */
  financialAlerts: ControlTowerFinancialAlerts;
  /** CFO-linjer: omsetning fra ordre; varekost/annonse avhengig av kilde-flagg. */
  finance: ControlTowerFinanceWeek;
  revenue: {
    todayTotal: number;
    weekTotal: number;
    /** Omsetning på aktive ordre denne uken med ai_social-attributjon. */
    fromAiAttributed: number;
    /** Samme filter, kun dagens dato (Oslo). */
    fromAiAttributedToday: number;
    /** Ordre-rader brukt til summer (for åpenhet ved avkapping). */
    ordersCountedToday: number;
    ordersCountedWeek: number;
    weekTruncated: boolean;
    dataSource: "orders" | "unavailable";
  };
  ai: {
    decisions24h: number;
    approved24h: number;
    skipped24h: number;
    lowConfidence24h: number;
    lastCycleAt: string | null;
    logAvailable: boolean;
  };
  performance: {
    topPostId: string | null;
    topPostRevenue: number;
    topProductId: string | null;
    topProductRevenue: number;
    /** Andel ordre denne uken med ai_social-attributjon (0–1), null uten nevner. */
    aiAttributedShareWeek: number | null;
  };
  system: {
    health: ControlTowerHealthLevel;
    lastHealthCheckAt: string;
    aiFailures24h: number;
    summary: string;
  };
  /** Deterministisk prognose + forslag (ingen auto-utførelse). */
  predictive: {
    dataAvailable: boolean;
    insufficientDataMessage: string | null;
    forecast: {
      todayKr: number | null;
      weekKr: number | null;
      confidence: number;
      methodNb: string;
      daysUsed: number;
      sufficientData: boolean;
    };
    trend: {
      direction: "up" | "down" | "flat";
      strength: number;
      explainNb: string;
    };
    anomalies: string[];
    recommendedActions: string[];
    basis: {
      lookbackDays: number;
      seriesTruncated: boolean;
      conversionDropPercent: number | null;
    };
  };
  /** Append-only enterprise audit (siste hendelser + enkel anomali-indikator). */
  auditCompliance: {
    recent: Array<{
      id: string;
      created_at: string;
      action: string;
      resource: string;
      source: string | null;
      actor_role: string | null;
    }>;
    suspicious24h: "high_activity" | null;
    complianceStatus: "ok" | "review";
  };
};
