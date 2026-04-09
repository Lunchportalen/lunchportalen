/**
 * Lette, deterministiske varsler fra Control Tower-snapshot (ingen sideeffekter).
 */

import type { ControlTowerData } from "@/lib/controlTower/types";

export function detectIssues(data: ControlTowerData): string[] {
  const alerts: string[] = [];

  if (data.ai.logAvailable && data.ai.lowConfidence24h > 5) {
    alerts.push("Lav AI-kvalitet: mange beslutninger med lav tillit siste døgn.");
  }

  if (data.revenue.dataSource === "orders" && data.revenue.todayTotal === 0) {
    alerts.push("Ingen registrert omsetning i dag (aktive ordre med line_total).");
  }

  if (data.system.health === "critical") {
    alerts.push("Systemstatus kritisk — se Systemhelse.");
  } else if (data.system.health === "warning") {
    alerts.push("Systemstatus advarsel — verifiser cron, utboks eller AI-jobber.");
  }

  if (data.system.aiFailures24h >= 10) {
    alerts.push("Mange AI-feil i logg siste døgn (metadata.resultStatus).");
  }

  if (data.revenue.weekTruncated) {
    alerts.push("Ukesomsetning kan være ufullstendig (avkappet uttrekk, maks 5000 ordre).");
  }

  if (!data.finance.cogsKnown || !data.finance.adSpendKnown) {
    alerts.push(
      "P&L (uke): varekost og/eller annonsespend er ikke fullstendig i aggregat — se forklaring under P&L-dashbordet.",
    );
  }

  if (data.auditCompliance.suspicious24h === "high_activity") {
    alerts.push("Audit: uvanlig høy aktivitet i enterprise-hendelseslogg siste 24 t — se revisjonslogg.");
  }

  return alerts;
}
