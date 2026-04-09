/**
 * Aggregering av finansinndata — ren funksjon, kilder må leveres av kaller.
 */

export type FinanceOrderLine = {
  total: number;
  productId?: string;
};

export type FinanceCampaignLine = {
  spend: number;
};

export type FinanceProductLine = {
  id: string;
  cost: number;
};

function finiteNonNeg(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

export function aggregateFinanceData(
  orders: FinanceOrderLine[],
  campaigns: FinanceCampaignLine[],
  products: FinanceProductLine[],
): { revenue: number; costOfGoods: number; adSpend: number } {
  const list = Array.isArray(orders) ? orders : [];
  const camps = Array.isArray(campaigns) ? campaigns : [];
  const prods = Array.isArray(products) ? products : [];

  const costById = new Map<string, number>();
  for (const p of prods) {
    const id = String(p.id ?? "").trim();
    if (!id) continue;
    costById.set(id, finiteNonNeg(p.cost));
  }

  let revenue = 0;
  let costOfGoods = 0;

  for (const o of list) {
    revenue += finiteNonNeg(o.total);
    const pid = typeof o.productId === "string" ? o.productId.trim() : "";
    if (pid && costById.has(pid)) {
      costOfGoods += costById.get(pid)!;
    }
  }

  let adSpend = 0;
  for (const c of camps) {
    adSpend += finiteNonNeg(c.spend);
  }

  return { revenue, costOfGoods, adSpend };
}
