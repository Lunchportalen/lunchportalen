import "server-only";

export type ChurnRiskRow = {
  scope: "system" | "company";
  companyId?: string;
  riskScore: number;
  churnProxy: number;
  suggestions: string[];
  notifyAdmin: boolean;
};

export type RetentionEngineInput = {
  churnRate?: number;
  revenueGrowth?: number;
  conversionRate?: number;
  inactiveCompanyIds?: string[];
};

/**
 * Detects churn pressure from proxies — suggestions + notify flag only (no outbound sends here).
 */
export function detectChurnRisk(input: RetentionEngineInput): ChurnRiskRow[] {
  const churn = Math.min(1, Math.max(0, Number(input.churnRate ?? 0)));
  const growth = Number(input.revenueGrowth ?? 0);
  const conv = Math.min(1, Math.max(0, Number(input.conversionRate ?? 0)));

  const rows: ChurnRiskRow[] = [];
  const suggestions: string[] = [];

  if (churn > 0.1) {
    suggestions.push("Kartlegg årsaker til churn (produkt, pris, onboarding) med kundeintervjuer.");
    suggestions.push("Aktiver målrettede suksess-tiltak for eksisterende kunder.");
  }
  if (growth < 0 && conv < 0.12) {
    suggestions.push("Konvertering og vekst begge svake — prioriter verdidokumentasjon og aktivering.");
  }

  const riskScore = Math.min(1, churn * 0.55 + (growth < 0 ? 0.25 : 0) + (conv < 0.1 ? 0.2 : 0));

  rows.push({
    scope: "system",
    riskScore,
    churnProxy: churn,
    suggestions: suggestions.length ? suggestions : ["Ingen sterk churn-signal i tilgjengelige proxy-data."],
    notifyAdmin: riskScore > 0.45,
  });

  const inactive = Array.isArray(input.inactiveCompanyIds) ? input.inactiveCompanyIds : [];
  for (const id of inactive.slice(0, 15)) {
    rows.push({
      scope: "company",
      companyId: id,
      riskScore: 0.62,
      churnProxy: 0.35,
      suggestions: ["Selskap uten aktivitet — kontakt kundesuksess og bekreft verdiuttak."],
      notifyAdmin: true,
    });
  }

  return rows;
}
