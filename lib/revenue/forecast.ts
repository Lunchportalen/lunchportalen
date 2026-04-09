/**
 * Enkel vektet pipeline-forecast (deterministisk, kun estimat — ikke faktura).
 */

export type LeadLike = {
  status?: string | null;
  value_estimate?: number | null;
};

export function forecastRevenue(leads: LeadLike[]): number {
  const list = Array.isArray(leads) ? leads : [];
  const weighted = list.map((l) => {
    const status = String(l.status ?? "").trim();
    const v = Number(l.value_estimate ?? 0) || 0;
    let prob = 0;
    if (status === "meeting") prob = 0.6;
    else if (status === "contacted") prob = 0.3;
    else if (status === "new") prob = 0.1;
    else if (status === "closed" || status === "lost") prob = 0;
    return v * prob;
  });
  const total = weighted.reduce((sum, x) => sum + x, 0);
  return Math.round(total);
}
