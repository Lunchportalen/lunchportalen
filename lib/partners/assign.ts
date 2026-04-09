export type OrderWithPartner = { partnerId?: string | null; [key: string]: unknown };

export type PartnerRef = { id: string };

export function assignPartner<T extends OrderWithPartner>(order: T, partners: PartnerRef[]): T {
  const first = Array.isArray(partners) && partners.length > 0 ? partners[0] : null;
  return {
    ...order,
    partnerId: first?.id ?? order.partnerId ?? null,
  };
}

export function scorePartner(
  _partner: PartnerRef,
  metrics: { deliveryScore: number; qualityScore: number },
): number {
  return Number(metrics.deliveryScore) + Number(metrics.qualityScore);
}
