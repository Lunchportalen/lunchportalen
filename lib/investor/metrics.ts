import "server-only";

import { collectAutopilotMetrics } from "@/lib/autopilot/collectMetrics";
import { getControlTowerData } from "@/lib/controlTower/aggregator";

export type ExitInvestorMetrics = {
  ARR: number;
  ARPU: number | null;
  LTV: number | null;
  churnRateMonthly: number | null;
  explain: string[];
};

function clampChurn(c: number | null | undefined): number | null {
  if (c == null || !Number.isFinite(c)) return null;
  if (c <= 0 || c >= 1) return null;
  return c;
}

/**
 * Exit-oriented KPIs (illustrative where churn is unknown — never fabricate churn).
 */
export function buildInvestorMetrics(args: {
  revenue: number;
  users: number;
  churn: number | null;
}): Omit<ExitInvestorMetrics, "explain"> {
  const users = Math.max(1, Math.floor(args.users));
  const arr = args.revenue;
  const arpu = arr / users;
  const churn = clampChurn(args.churn);
  let ltv: number | null = null;
  if (churn != null) {
    ltv = arpu * (1 / churn);
  }
  return {
    ARR: arr,
    ARPU: arr > 0 ? arpu : null,
    LTV: ltv,
    churnRateMonthly: churn,
  };
}

export async function collectInvestorMetrics(rid: string): Promise<ExitInvestorMetrics> {
  const explain: string[] = [];
  const [ct, am] = await Promise.all([getControlTowerData(), collectAutopilotMetrics()]);

  const revenue = ct.revenue.weekTotal * 52;
  const users = am.ok ? Math.max(1, am.metrics.sessions) : 1;
  if (!am.ok) {
    explain.push("Brukere proxy fra session-teller utilgjengelig — bruker 1 som minimum.");
  }
  explain.push("ARR approximert som ukeomsetning × 52 (kontroller mot regnskap).");
  explain.push("Churn ikke koblet — LTV utelatt (null) inntil månedlig churn er målt.");

  const base = buildInvestorMetrics({ revenue, users, churn: null });
  return {
    ...base,
    explain: [...explain, `rid:${rid}`],
  };
}
