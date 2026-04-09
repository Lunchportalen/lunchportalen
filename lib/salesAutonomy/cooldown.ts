const COOLDOWN_MS = 86_400_000;
const lastTouch = new Map<string, number>();

export function isDealCooldownClear(dealId: string): boolean {
  const t = lastTouch.get(dealId);
  if (t == null) return true;
  return Date.now() - t > COOLDOWN_MS;
}

export function markDealAutonomyTouch(dealId: string): void {
  lastTouch.set(dealId, Date.now());
}

export function filterDealsNotInCooldown<T extends { id: string }>(deals: T[]): T[] {
  const list = Array.isArray(deals) ? deals : [];
  return list.filter((d) => typeof d.id === "string" && isDealCooldownClear(d.id));
}
