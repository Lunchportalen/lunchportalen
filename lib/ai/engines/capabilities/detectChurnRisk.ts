/**
 * Churn-risk detector capability: detectChurnRisk.
 * Assesses churn risk from customer signals: days since last activity, order/login
 * frequency, support tickets, NPS, tenure, contract end. Returns risk level, score,
 * contributing factors, and recommendation. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectChurnRisk";

const detectChurnRiskCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Churn-risk detector: from customer signals (daysSinceLastActivity, orderCount, loginCount, supportTickets, npsScore, tenureDays, contractEndsAt), assesses churn risk. Returns riskLevel (high/medium/low), riskScore (0-100), factors, and recommendation. Supports single customer or batch. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect churn risk input",
    properties: {
      customer: {
        type: "object",
        description: "Single customer signals",
        properties: {
          userId: { type: "string" },
          daysSinceLastActivity: { type: "number" },
          orderCount: { type: "number" },
          loginCount: { type: "number" },
          supportTicketsCount: { type: "number" },
          npsScore: { type: "number", description: "0-10 or -100 to 100" },
          tenureDays: { type: "number", description: "Days as customer" },
          contractEndsAt: { type: "string", description: "ISO date of contract end" },
        },
      },
      customers: {
        type: "array",
        description: "Batch: same shape as customer",
        items: { type: "object" },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Churn risk detection result",
    required: ["riskLevel", "riskScore", "factors", "recommendation", "detectedAt"],
    properties: {
      customerId: { type: "string" },
      riskLevel: { type: "string", enum: ["high", "medium", "low"] },
      riskScore: { type: "number", description: "0-100, higher = more risk" },
      factors: { type: "array", items: { type: "string" } },
      recommendation: { type: "string" },
      detectedAt: { type: "string" },
      results: {
        type: "array",
        description: "When batch input, per-customer results",
        items: {
          type: "object",
          required: ["customerId", "riskLevel", "riskScore", "factors", "recommendation"],
          properties: {
            customerId: { type: "string" },
            riskLevel: { type: "string" },
            riskScore: { type: "number" },
            factors: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is risk assessment only; no customer or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectChurnRiskCapability);

export type CustomerChurnSignals = {
  userId?: string | null;
  daysSinceLastActivity?: number | null;
  orderCount?: number | null;
  loginCount?: number | null;
  supportTicketsCount?: number | null;
  npsScore?: number | null;
  tenureDays?: number | null;
  contractEndsAt?: string | null;
};

export type DetectChurnRiskInput = {
  customer?: CustomerChurnSignals | null;
  customers?: CustomerChurnSignals[] | null;
  locale?: "nb" | "en" | null;
};

export type ChurnRiskResult = {
  customerId: string;
  riskLevel: "high" | "medium" | "low";
  riskScore: number;
  factors: string[];
  recommendation: string;
};

export type DetectChurnRiskOutput = {
  customerId?: string | null;
  riskLevel: "high" | "medium" | "low";
  riskScore: number;
  factors: string[];
  recommendation: string;
  detectedAt: string;
  results?: ChurnRiskResult[] | null;
  summary?: string | null;
};

const INACTIVITY_HIGH_DAYS = 30;
const INACTIVITY_MEDIUM_DAYS = 14;
const LOW_ORDER_THRESHOLD = 1;
const LOW_LOGIN_THRESHOLD = 2;
const NPS_AT_RISK = 6;
const CONTRACT_ENDING_DAYS = 30;

function assessOne(signals: CustomerChurnSignals, isEn: boolean): ChurnRiskResult {
  const userId = String(signals.userId ?? "").trim() || "unknown";
  const daysInactive = Math.max(0, Number(signals.daysSinceLastActivity) ?? 0);
  const orderCount = Math.max(0, Number(signals.orderCount) ?? 0);
  const loginCount = Math.max(0, Number(signals.loginCount) ?? 0);
  const supportTickets = Math.max(0, Number(signals.supportTicketsCount) ?? 0);
  let nps = Number(signals.npsScore);
  if (nps > 10) nps = (nps + 100) / 20 - 5;
  const tenureDays = Math.max(0, Number(signals.tenureDays) ?? 0);
  const contractEnd = signals.contractEndsAt ? new Date(String(signals.contractEndsAt)).getTime() : null;
  const now = Date.now();
  const daysToContractEnd = contractEnd ? Math.max(0, Math.floor((contractEnd - now) / (24 * 60 * 60 * 1000))) : null;

  const factors: string[] = [];
  let score = 0;

  if (daysInactive >= INACTIVITY_HIGH_DAYS) {
    score += 35;
    factors.push(isEn ? `No activity for ${daysInactive} days` : `Ingen aktivitet på ${daysInactive} dager`);
  } else if (daysInactive >= INACTIVITY_MEDIUM_DAYS) {
    score += 20;
    factors.push(isEn ? `Low activity (${daysInactive} days since last)` : `Lav aktivitet (${daysInactive} dager siden sist)`);
  }

  if (orderCount <= LOW_ORDER_THRESHOLD && tenureDays > 30) {
    score += 20;
    factors.push(isEn ? `Few orders (${orderCount}) for tenure` : `Få bestillinger (${orderCount}) for lengde`);
  }

  if (loginCount <= LOW_LOGIN_THRESHOLD && tenureDays > 14) {
    score += 15;
    factors.push(isEn ? `Low login frequency (${loginCount})` : `Lav innloggingsfrekvens (${loginCount})`);
  }

  if (supportTickets >= 2) {
    score += 15;
    factors.push(isEn ? `Multiple support tickets (${supportTickets})` : `Flere supporthenvendelser (${supportTickets})`);
  }

  if (typeof nps === "number" && !Number.isNaN(nps) && nps <= NPS_AT_RISK) {
    score += 20;
    factors.push(isEn ? `Low NPS (${nps})` : `Lav NPS (${nps})`);
  }

  if (daysToContractEnd != null && daysToContractEnd <= CONTRACT_ENDING_DAYS) {
    score += 25;
    factors.push(isEn ? `Contract ends in ${daysToContractEnd} days` : `Avtale utløper om ${daysToContractEnd} dager`);
  }

  const riskScore = Math.min(100, score);
  const riskLevel: "high" | "medium" | "low" = riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low";

  let recommendation: string;
  if (riskLevel === "high") {
    recommendation = isEn
      ? "Prioritize outreach: personalized email or call, offer or success check before contract end."
      : "Prioriter oppfølging: personlig e-post eller oppringing, tilbud eller suksesssjekk før avtaleutløp.";
  } else if (riskLevel === "medium") {
    recommendation = isEn
      ? "Add to re-engagement list; consider in-app message or light-touch email."
      : "Legg til i re-engagement-liste; vurder melding i app eller lett e-post.";
  } else {
    recommendation = isEn
      ? "Low risk; maintain usual engagement and monitor for changes."
      : "Lav risiko; oppretthold vanlig engasjement og overvåk for endringer.";
  }

  return {
    customerId: userId,
    riskLevel,
    riskScore,
    factors,
    recommendation,
  };
}

/**
 * Assesses churn risk from customer signals. Single or batch. Deterministic; no external calls.
 */
export function detectChurnRisk(input: DetectChurnRiskInput = {}): DetectChurnRiskOutput {
  const isEn = input.locale === "en";
  const batch = Array.isArray(input.customers) ? input.customers : input.customer ? [input.customer] : [];

  if (batch.length === 0) {
    return {
      riskLevel: "low",
      riskScore: 0,
      factors: [],
      recommendation: isEn ? "No customer data; provide signals to assess churn risk." : "Ingen kundedata; angi signaler for å vurdere churn-risiko.",
      detectedAt: new Date().toISOString(),
    };
  }

  const results = batch.map((c) => assessOne(c, isEn));

  if (results.length === 1) {
    const r = results[0]!;
    return {
      customerId: r.customerId,
      riskLevel: r.riskLevel,
      riskScore: r.riskScore,
      factors: r.factors,
      recommendation: r.recommendation,
      detectedAt: new Date().toISOString(),
    };
  }

  const highCount = results.filter((r) => r.riskLevel === "high").length;
  const mediumCount = results.filter((r) => r.riskLevel === "medium").length;
  const summary = isEn
    ? `Assessed ${results.length} customer(s): ${highCount} high-risk, ${mediumCount} medium-risk.`
    : `Vurdert ${results.length} kunde(r): ${highCount} høy risiko, ${mediumCount} medium risiko.`;

  return {
    riskLevel: highCount > 0 ? "high" : mediumCount > 0 ? "medium" : "low",
    riskScore: Math.round(
      results.reduce((s, r) => s + r.riskScore, 0) / results.length
    ),
    factors: [],
    recommendation: summary,
    detectedAt: new Date().toISOString(),
    results,
    summary,
  };
}

export { detectChurnRiskCapability, CAPABILITY_NAME };
