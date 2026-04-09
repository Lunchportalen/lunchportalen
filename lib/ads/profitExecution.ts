/**
 * Profit-first pipeline: beregning → guardrails → beslutning → forslag.
 * Fail-closed: ugyldige data → pause / ingen skalering; ingen automatisk pengebruk.
 */

import { controlAccount, type AccountControlStatus } from "@/lib/ads/account";
import { decideAction, type AutonomyProfitAction } from "@/lib/ads/autonomy";
import { calculateMargin, calculateProfit } from "@/lib/ads/profit";
import { classifyProfit, type ProfitStrengthClass } from "@/lib/ads/profitClassifier";
import { guardrails } from "@/lib/ads/guardrails";
import { enforceCaps } from "@/lib/ads/protection";
import { calculateROAS } from "@/lib/ads/roas";
import { scaleCampaign } from "@/lib/ads/scaling";
import { cutLosses } from "@/lib/ads/cut";

export type CampaignProfitInput = {
  name: string;
  budget: number;
  spend: number;
  revenue: number;
};

export type ProfitUiBand = "profitable" | "breakeven" | "loss";

export type ProfitExecutionHint = "scale_safe" | "hold" | "reduce_budget" | "pause" | "blocked";

export type ProfitEvaluationRow = {
  campaignName: string;
  profit: number;
  margin: number;
  roas: number;
  budget: number;
  profitClass: ProfitStrengthClass;
  autonomyDecision: AutonomyProfitAction;
  executionHint: ProfitExecutionHint;
  proposedBudget: number | null;
  uiBand: ProfitUiBand;
  blockedReasons: string[];
  killSwitchActive: boolean;
  accountFrozen: boolean;
  protectedCampaign: boolean;
};

function validMetrics(budget: number, spend: number, revenue: number): boolean {
  return (
    typeof budget === "number" &&
    Number.isFinite(budget) &&
    budget >= 0 &&
    typeof spend === "number" &&
    Number.isFinite(spend) &&
    spend >= 0 &&
    typeof revenue === "number" &&
    Number.isFinite(revenue) &&
    revenue >= 0
  );
}

function uiBandFromClass(c: ProfitStrengthClass): ProfitUiBand {
  if (c === "strong") return "profitable";
  if (c === "weak") return "breakeven";
  return "loss";
}

function applyMaxIncrease(from: number, to: number): number {
  const maxTo = from * (1 + guardrails.maxDailyChange);
  return Math.min(to, maxTo);
}

function applyMaxDecrease(from: number, factor: number): number {
  const minAfterCut = from * (1 - guardrails.maxDailyChange);
  const target = from * factor;
  return Math.max(target, minAfterCut);
}

function clampDailyBudget(budget: number): number {
  return Math.min(budget, guardrails.maxDailyBudget);
}

export function evaluateProfitFirstRow(
  input: CampaignProfitInput,
  ctx: { accountTotalSpend: number; accountStatus: AccountControlStatus },
): ProfitEvaluationRow {
  const blockedReasons: string[] = [];
  const name = input.name.trim() || "Uten navn";

  if (!validMetrics(input.budget, input.spend, input.revenue)) {
    return {
      campaignName: name,
      profit: 0,
      margin: 0,
      roas: 0,
      budget: Number.isFinite(input.budget) ? Math.max(0, input.budget) : 0,
      profitClass: "loss",
      autonomyDecision: "cut",
      executionHint: "pause",
      proposedBudget: null,
      uiBand: "loss",
      blockedReasons: ["Ukjente eller ugyldige tall — fail-closed (ingen skalering)."],
      killSwitchActive: false,
      accountFrozen: ctx.accountStatus === "freeze_all",
      protectedCampaign: true,
    };
  }

  const base = { spend: input.spend, revenue: input.revenue };
  const profit = calculateProfit(base);
  const margin = calculateMargin(base);
  const roas = calculateROAS(base);
  const profitClass = classifyProfit(base);
  const autonomyDecision = decideAction(base);

  const killSwitchActive =
    input.spend >= guardrails.killSwitchSpend &&
    roas < guardrails.killSwitchROAS &&
    input.spend > 0;

  if (killSwitchActive) {
    blockedReasons.push(
      `Kill-switch: spend ≥ ${guardrails.killSwitchSpend} kr og ROAS < ${guardrails.killSwitchROAS}.`,
    );
  }

  const accountFrozen = ctx.accountStatus === "freeze_all";
  if (accountFrozen) {
    blockedReasons.push(`Kontofryst: total spend > ${guardrails.maxAccountBudget} kr.`);
  }

  let proposedBudget: number | null = null;
  let executionHint: ProfitExecutionHint = "hold";
  let protectedCampaign = false;

  if (killSwitchActive || accountFrozen) {
    executionHint = killSwitchActive ? "pause" : "blocked";
    proposedBudget = null;
    protectedCampaign = true;
  } else if (autonomyDecision === "scale") {
    if (roas < guardrails.minROAS) {
      blockedReasons.push(`ROAS ${roas.toFixed(2)} under minROAS ${guardrails.minROAS} — ingen skalering.`);
      executionHint = "hold";
      proposedBudget = null;
      protectedCampaign = true;
    } else if (margin < guardrails.minMargin) {
      blockedReasons.push(
        `Margin ${margin.toFixed(3)} under minMargin ${guardrails.minMargin} — ingen skalering.`,
      );
      executionHint = "hold";
      proposedBudget = null;
      protectedCampaign = true;
    } else {
      const scaled = scaleCampaign({ ...base, budget: input.budget });
      const afterIncrease = applyMaxIncrease(input.budget, scaled);
      const capCamp = { budget: afterIncrease };
      const capStatus = enforceCaps(capCamp, { totalSpend: ctx.accountTotalSpend });
      const next = capCamp.budget;
      if (capStatus === "freeze") {
        blockedReasons.push("Konto over maksgrense — ingen budsjettøkning.");
        executionHint = "blocked";
        proposedBudget = null;
        protectedCampaign = true;
      } else {
        proposedBudget = Math.round(next);
        executionHint = "scale_safe";
      }
    }
  } else if (autonomyDecision === "hold") {
    executionHint = "hold";
    proposedBudget = null;
  } else {
    const cut = cutLosses(base);
    if (!cut) {
      executionHint = "hold";
      proposedBudget = null;
    } else if (cut.action === "pause") {
      executionHint = "pause";
      proposedBudget = null;
      protectedCampaign = true;
    } else {
      const nextRaw = applyMaxDecrease(input.budget, cut.factor);
      proposedBudget = Math.round(clampDailyBudget(nextRaw));
      executionHint = "reduce_budget";
      protectedCampaign = proposedBudget < input.budget;
    }
  }

  const isDefensive =
    executionHint === "pause" || executionHint === "blocked" || executionHint === "reduce_budget";

  return {
    campaignName: name,
    profit,
    margin,
    roas,
    budget: input.budget,
    profitClass,
    autonomyDecision,
    executionHint,
    proposedBudget,
    uiBand: uiBandFromClass(profitClass),
    blockedReasons,
    killSwitchActive,
    accountFrozen,
    protectedCampaign: protectedCampaign || isDefensive,
  };
}

export function evaluateProfitFirstAll(rows: CampaignProfitInput[]): {
  accountStatus: AccountControlStatus;
  accountTotalSpend: number;
  rowResults: ProfitEvaluationRow[];
  profitSummary: {
    totalProfit: number;
    totalSpend: number;
    totalRevenue: number;
    campaignsProtected: number;
    actionsSuggested: string[];
  };
} {
  const safeRows = Array.isArray(rows) ? rows : [];
  const slim = safeRows.map((r) => ({ spend: Math.max(0, r.spend) }));
  const accountStatus = controlAccount(slim);
  const accountTotalSpend = slim.reduce((s, c) => s + c.spend, 0);

  const rowResults = safeRows.map((r) =>
    evaluateProfitFirstRow(
      {
        name: r.name,
        budget: r.budget,
        spend: Math.max(0, r.spend),
        revenue: Math.max(0, r.revenue),
      },
      { accountTotalSpend, accountStatus },
    ),
  );

  const totalProfit = rowResults.reduce((s, r) => s + r.profit, 0);
  const totalSpend = safeRows.reduce((s, r) => s + Math.max(0, r.spend), 0);
  const totalRevenue = safeRows.reduce((s, r) => s + Math.max(0, r.revenue), 0);
  const campaignsProtected = rowResults.filter((r) => r.protectedCampaign).length;
  const actionsSuggested = rowResults.map(
    (r) =>
      `${r.campaignName}: ${r.executionHint}${r.proposedBudget != null ? ` → ${r.proposedBudget} kr` : ""}`,
  );

  return {
    accountStatus,
    accountTotalSpend,
    rowResults,
    profitSummary: {
      totalProfit,
      totalSpend,
      totalRevenue,
      campaignsProtected,
      actionsSuggested,
    },
  };
}
