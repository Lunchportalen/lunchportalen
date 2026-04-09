import "server-only";

import { trackConversion } from "@/lib/ai/attribution";

const idempotencySeen = new Set<string>();
const IDEMPOTENCY_CAP = 10_000;

function remember(key: string): boolean {
  if (idempotencySeen.has(key)) return false;
  idempotencySeen.add(key);
  if (idempotencySeen.size > IDEMPOTENCY_CAP) {
    idempotencySeen.clear();
  }
  return true;
}

export type RevenueTriggerInput = {
  amount: number;
  idempotencyKey?: string;
  context?: Record<string, unknown>;
};

/**
 * Læringssignal til attribusjon (ikke bokført omsetning). Krever eksplisitt beløp og idempotens.
 */
export async function triggerRevenue(event: RevenueTriggerInput): Promise<{ ok: boolean; skipped?: boolean }> {
  const amount = typeof event.amount === "number" && Number.isFinite(event.amount) ? event.amount : 0;
  if (amount <= 0) return { ok: false };

  const key = String(event.idempotencyKey ?? "").trim() || `rev_${amount}_${JSON.stringify(event.context ?? {}).slice(0, 80)}`;
  if (!remember(key)) {
    return { ok: true, skipped: true };
  }

  await trackConversion({
    source: "ai",
    key: "sales",
    revenue: amount,
    context: {
      ...(event.context && typeof event.context === "object" ? event.context : {}),
      signal_kind: "sales_pipeline",
      not_booked_revenue: true,
    },
  });

  return { ok: true };
}
