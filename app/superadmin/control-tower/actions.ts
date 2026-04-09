"use server";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import type { SimulationRiskLevel } from "@/lib/simulation/risk";

export async function controlTowerFinanceSimulationLogAction(payload: {
  scenarioFlags: { increaseBudget: boolean; priceIncrease: boolean; priceDecrease: boolean };
  baseInputs: { revenue: number; costOfGoods: number; adSpend: number };
  result: {
    netProfit: number;
    margin: number;
    revenue: number;
    grossProfit: number;
    adSpend: number;
    costOfGoods: number;
  };
  risk: SimulationRiskLevel;
}) {
  const auth = await getAuthContext();
  if (!auth.ok || auth.role !== "superadmin") {
    return { ok: false as const, error: "Ingen tilgang" as const };
  }

  void logAiExecution({
    capability: "control_tower_finance_simulation",
    resultStatus: "success",
    userId: auth.userId,
    metadata: {
      domain: "finance_simulation",
      scenarioFlags: payload.scenarioFlags,
      baseInputs: payload.baseInputs,
      result: payload.result,
      risk: payload.risk,
      note: "Simulering logget — ingen automatisk økonomihandling.",
    },
  });

  return { ok: true as const };
}

export type ControlTowerInsightSurface =
  | "recommendation"
  | "financial_alert"
  | "anomaly"
  | "drift_alert"
  | "experiment"
  | "growth";

export type ControlTowerInsightChoice = "execute" | "ignore" | "detail";

/**
 * Logger brukervalg i kontrolltårn (ingen automatisk motor — kun audit/sporbarhet).
 * Samme mønster som {@link controlTowerFinanceSimulationLogAction}.
 */
export async function controlTowerInsightAction(payload: {
  surface: ControlTowerInsightSurface;
  choice: ControlTowerInsightChoice;
  refKey: string;
  label?: string | null;
}) {
  const auth = await getAuthContext();
  if (!auth.ok || auth.role !== "superadmin") {
    return { ok: false as const, error: "Ingen tilgang" as const };
  }

  const ref = String(payload.refKey ?? "").trim().slice(0, 400);
  if (!ref.length) {
    return { ok: false as const, error: "Mangler referanse" as const };
  }

  void logAiExecution({
    capability: "control_tower_insight_choice",
    resultStatus: "success",
    userId: auth.userId,
    metadata: {
      domain: "control_tower",
      surface: payload.surface,
      choice: payload.choice,
      refKey: ref,
      label: payload.label ? String(payload.label).trim().slice(0, 600) : null,
      note: "Manuelt valg i kontrolltårn — ingen skjult sideeffekt utenom logging.",
    },
  });

  return { ok: true as const };
}
