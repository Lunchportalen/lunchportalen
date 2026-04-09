/**
 * AI Sales Opportunity Engine capability: detectSalesOpportunities.
 * AI identifiserer firmaer som bør: oppgradere plan, øke volum.
 * Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "salesOpportunityDetector";

const salesOpportunityDetectorCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Sales opportunity engine: identifies companies that should upgrade plan or increase volume. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Sales opportunity detector input",
    properties: {
      companies: {
        type: "array",
        description: "Companies with usage and current agreement",
        items: {
          type: "object",
          properties: {
            companyId: { type: "string" },
            companyName: { type: "string" },
            currentAgreementLevel: { type: "string", enum: ["basis", "luksus", "unknown"] },
            deliveryDaysPerWeek: { type: "number" },
            potentialDeliveryDaysPerWeek: { type: "number", description: "e.g. 5 if they could add days" },
            totalOrdersInPeriod: { type: "number" },
            luxuryOrdersInPeriod: { type: "number", description: "Orders that were luxury-tier" },
          },
        },
      },
      periodLabel: { type: "string", description: "e.g. last 4 weeks" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["companies"],
  },
  outputSchema: {
    type: "object",
    description: "Sales opportunities: oppgradere plan, øke volum",
    required: ["opportunities", "summary", "generatedAt"],
    properties: {
      opportunities: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is sales suggestions only; no contract or system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(salesOpportunityDetectorCapability);

export type CompanyUsageInput = {
  companyId: string;
  companyName?: string | null;
  currentAgreementLevel?: "basis" | "luksus" | "unknown" | null;
  deliveryDaysPerWeek?: number | null;
  /** If higher than deliveryDaysPerWeek, may suggest "increase volume" (more days). */
  potentialDeliveryDaysPerWeek?: number | null;
  totalOrdersInPeriod: number;
  luxuryOrdersInPeriod: number;
};

export type SalesOpportunityDetectorInput = {
  companies: CompanyUsageInput[];
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type SalesOpportunityType = "upgrade_plan" | "increase_volume";

export type UpgradeOpportunity = {
  companyId: string;
  companyName: string | null;
  opportunityType: SalesOpportunityType;
  suggestedUpgrade: "luksus" | "basis" | null;
  /** True when opportunity is to increase volume (e.g. more delivery days). */
  suggestVolumeIncrease?: boolean | null;
  rationale: string;
  confidence: "high" | "medium" | "low";
  /** e.g. "3/5 dager luksus" or "2/5 dager – øk til flere dager" */
  signalSummary: string;
};

export type SalesOpportunityDetectorOutput = {
  opportunities: UpgradeOpportunity[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Minimum andel luksusbestillinger (0–1) for å foreslå luksusavtale. */
const LUXURY_UPGRADE_THRESHOLD = 0.5;
/** Minimum antall luksusbestillinger per uke (ca.) for å vurdere oppgradering. */
const LUXURY_MIN_ORDERS_PER_WEEK = 2;
/** Minimum bestillinger i perioden for å foreslå volumøkning (viser engasjement). */
const MIN_ORDERS_FOR_VOLUME_INCREASE = 4;

/**
 * Detects sales opportunities: oppgradere plan, øke volum. Deterministic.
 */
export function detectSalesOpportunities(
  input: SalesOpportunityDetectorInput
): SalesOpportunityDetectorOutput {
  const isEn = input.locale === "en";
  const companies = Array.isArray(input.companies) ? input.companies : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");

  const opportunities: UpgradeOpportunity[] = [];

  for (const c of companies) {
    const companyId = safeStr(c.companyId);
    if (!companyId) continue;

    const companyName = safeStr(c.companyName) || null;
    const currentLevel = c.currentAgreementLevel ?? "unknown";
    const deliveryDays = Math.max(0, safeNum(c.deliveryDaysPerWeek)) || 5;
    const potentialDays = Math.max(0, safeNum(c.potentialDeliveryDaysPerWeek)) || 5;
    const totalOrders = Math.max(0, safeNum(c.totalOrdersInPeriod));
    const luxuryOrders = Math.max(0, safeNum(c.luxuryOrdersInPeriod));

    const luxuryShare = totalOrders > 0 ? luxuryOrders / totalOrders : 0;
    const luxuryPerWeek = luxuryOrders / 4;

    // --- Oppgradere plan (luksus / basis) ---
    let suggestedUpgrade: "luksus" | "basis" | null = null;
    let rationale = "";
    let confidence: "high" | "medium" | "low" = "medium";
    let signalSummary = "";

    if (currentLevel !== "luksus" && totalOrders > 0) {
      const meetsShare = luxuryShare >= LUXURY_UPGRADE_THRESHOLD;
      const meetsVolume = luxuryPerWeek >= LUXURY_MIN_ORDERS_PER_WEEK;
      if (meetsShare && meetsVolume) {
        suggestedUpgrade = "luksus";
        const luxuryDaysHint =
          deliveryDays > 0
            ? Math.round(luxuryShare * deliveryDays)
            : Math.round(luxuryShare * 5);
        signalSummary = isEn
          ? `Luxury orders ~${luxuryDaysHint}/${deliveryDays} days (${Math.round(luxuryShare * 100)}% luxury)`
          : `Luksusbestillinger ca. ${luxuryDaysHint}/${deliveryDays} dager (${Math.round(luxuryShare * 100)} % luksus)`;
        rationale = isEn
          ? `Company orders luxury-tier ${Math.round(luxuryShare * 100)}% of the time; suggest luxury agreement for better alignment and value.`
          : `Firma bestiller luksusnivå ${Math.round(luxuryShare * 100)} % av tiden; foreslå luksusavtale for bedre tilpasning og verdi.`;
        confidence = luxuryShare >= 0.6 && luxuryPerWeek >= 4 ? "high" : luxuryShare >= 0.5 ? "medium" : "low";
      }
    }

    if (currentLevel === "luksus" && totalOrders > 0 && luxuryShare < 0.25) {
      suggestedUpgrade = "basis";
      signalSummary = isEn
        ? `Low luxury share (${Math.round(luxuryShare * 100)}%); mostly basic orders`
        : `Lav luksusandel (${Math.round(luxuryShare * 100)} %); stort sett basisbestillinger`;
      rationale = isEn
        ? "Company rarely orders luxury; consider suggesting basic agreement to match usage."
        : "Firma bestiller sjelden luksus; vurder å foreslå basisavtale som matcher bruken.";
      confidence = luxuryShare < 0.15 ? "high" : "medium";
    }

    if (suggestedUpgrade) {
      opportunities.push({
        companyId,
        companyName,
        opportunityType: "upgrade_plan",
        suggestedUpgrade,
        suggestVolumeIncrease: false,
        rationale,
        confidence,
        signalSummary,
      });
    }

    // --- Øke volum (flere leveringsdager) ---
    if (
      potentialDays > deliveryDays &&
      totalOrders >= MIN_ORDERS_FOR_VOLUME_INCREASE
    ) {
      const extraDays = potentialDays - deliveryDays;
      opportunities.push({
        companyId,
        companyName,
        opportunityType: "increase_volume",
        suggestedUpgrade: null,
        suggestVolumeIncrease: true,
        rationale: isEn
          ? `Company uses ${deliveryDays} delivery day(s) per week; capacity suggests up to ${potentialDays}. Consider suggesting more days to increase volume.`
          : `Firma bruker ${deliveryDays} leveringsdag(er) per uke; kapasitet tyder på inntil ${potentialDays}. Vurder å foreslå flere dager for å øke volum.`,
        confidence: extraDays >= 2 ? "high" : "medium",
        signalSummary: isEn
          ? `${deliveryDays}/${potentialDays} days – increase to more days`
          : `${deliveryDays}/${potentialDays} dager – øk til flere dager`,
      });
    }
  }

  const upgradeCount = opportunities.filter((o) => o.suggestedUpgrade === "luksus").length;
  const downgradeCount = opportunities.filter((o) => o.suggestedUpgrade === "basis").length;
  const volumeCount = opportunities.filter((o) => o.opportunityType === "increase_volume").length;
  const summary = isEn
    ? `Found ${opportunities.length} sales opportunity(ies) for ${periodLabel}: ${upgradeCount} upgrade plan, ${downgradeCount} consider basic, ${volumeCount} increase volume.`
    : `Fant ${opportunities.length} salgsmulighet(er) for ${periodLabel}: ${upgradeCount} oppgradere plan, ${downgradeCount} vurder basis, ${volumeCount} øke volum.`;

  return {
    opportunities,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
