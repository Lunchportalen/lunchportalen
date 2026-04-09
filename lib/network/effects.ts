export type NetworkEntity = { id: string };

/**
 * Enkel nettverksverdi-metrikk (skalerer med begge sider — ikke PII).
 */
export function networkValue(companies: NetworkEntity[], partners: NetworkEntity[]): number {
  const c = Array.isArray(companies) ? companies.length : 0;
  const p = Array.isArray(partners) ? partners.length : 0;
  return c * p;
}

/** Samme modell uten å allokere store lister (store companyCount). */
export function networkValueFromCounts(companyCount: number, partnerCount: number): number {
  const c = Math.max(0, Math.floor(Number(companyCount)));
  const p = Math.max(0, Math.floor(Number(partnerCount)));
  return c * p;
}

export type AggregatedInsight = { tenantId: string; [key: string]: unknown };

/**
 * Kryss-læring: ekskluder egen tenant — kun mønstre/aggregater.
 */
export function shareInsights(globalData: AggregatedInsight[], tenantId: string): AggregatedInsight[] {
  const tid = String(tenantId ?? "").trim();
  const list = Array.isArray(globalData) ? globalData : [];
  return list.filter((d) => d.tenantId !== tid);
}
