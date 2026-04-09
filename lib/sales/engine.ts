import "server-only";

import { auditLog } from "@/lib/core/audit";
import { triggerRevenue } from "@/lib/revenue/trigger";
import { decideAction, type SalesNextAction } from "@/lib/sales/decision";
import { scoreLead } from "@/lib/sales/score";
import { opsLog } from "@/lib/ops/log";

export type SalesEngineResult = {
  lead: unknown;
  action: SalesNextAction;
  score: number;
  revenueSignal?: "recorded" | "skipped" | "none";
};

function safeLeadMeta(lead: unknown): Record<string, unknown> {
  try {
    const s = JSON.stringify(lead);
    return { preview: s.slice(0, 1500) };
  } catch {
    return { preview: "[unserializable]" };
  }
}

export type RunSalesAIOptions = {
  /** Kun når superadmin eksplisitt ber om det — skriver læringssignal (ikke fakturert inntekt). */
  recordRevenueSignals?: boolean;
  idempotencyPrefix?: string;
};

/**
 * Kvalifiserer leads og foreslår neste steg. Ingen e-post / avtale uten egen flyt.
 */
export async function runSalesAI(leads: unknown[], opts?: RunSalesAIOptions): Promise<SalesEngineResult[]> {
  const list = Array.isArray(leads) ? leads : [];
  const results: SalesEngineResult[] = [];
  const prefix = String(opts?.idempotencyPrefix ?? "sales").slice(0, 64);
  let i = 0;

  for (const lead of list) {
    const action = decideAction(lead);
    const score = scoreLead(lead);

    await auditLog({
      action: "sales_decision",
      entity: action,
      metadata: safeLeadMeta(lead),
    });

    let revenueSignal: SalesEngineResult["revenueSignal"] = "none";

    if (action === "book_meeting" && opts?.recordRevenueSignals === true) {
      const est = Math.min(100, Math.max(0, score)) * 10;
      const idem = `${prefix}:${i}`;
      const tr = await triggerRevenue({
        amount: est,
        idempotencyKey: idem,
        context: { action: "book_meeting", score },
      });
      revenueSignal = tr.skipped ? "skipped" : "recorded";
      opsLog("sales_revenue_signal", { action: "book_meeting", amount: est, skipped: Boolean(tr.skipped) });
    }

    results.push({ lead, action, score, revenueSignal });
    i += 1;
  }

  return results;
}

export { generateOutboundMessage } from "./outboundTemplate";
export { trackLeadConversion } from "./attribution";
