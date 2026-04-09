// STATUS: KEEP

/**
 * AI LUNCH ECOSYSTEM BRAIN
 * Det store systemet: AI kobler sammen bestillinger, menyer, kjøkken, levering, kundeanalyse.
 * Platform Intelligence (platform_intelligence) er selve hjernen: én modell, strategiske anbefalinger og vekstmuligheter.
 */

import { runDemandForecastEngine } from "@/lib/ai/forecast/demandForecastEngine";
import { runLunchMenuOptimizer } from "@/lib/ai/menu/lunchMenuOptimizer";
import { runFoodPairingEngine } from "@/lib/ai/pairing/foodPairingEngine";
import { runLunchHealthAnalyzerEngine } from "@/lib/ai/nutrition/lunchHealthAnalyzerEngine";
import { runMenuCreativityEngine } from "@/lib/ai/creativity/menuCreativityEngine";
import { runLunchExperienceDesignerEngine } from "@/lib/ai/experience/lunchExperienceDesignerEngine";
import { runKitchenLoadBalancerEngine } from "@/lib/ai/kitchen/kitchenLoadBalancerEngine";
import { runKitchenRiskDetectorEngine } from "@/lib/ai/kitchen/kitchenRiskDetectorEngine";
import { runKitchenCapacityOptimizerEngine } from "@/lib/ai/kitchen/kitchenCapacityOptimizerEngine";
import { runWasteReductionEngine } from "@/lib/ai/waste/wasteReductionEngine";
import { runProcurementAdvisorEngine } from "@/lib/ai/procurement/procurementAdvisorEngine";
import { runDeliveryRouteIntelligenceEngine } from "@/lib/ai/delivery/deliveryRouteIntelligenceEngine";
import { runDeliveryIntelligenceEngine } from "@/lib/ai/delivery/deliveryIntelligenceEngine";
import { runOfficeBehaviourModel } from "@/lib/ai/behaviour/officeBehaviourModel";
import { runOfficeCultureAnalyzerEngine } from "@/lib/ai/culture/officeCultureAnalyzerEngine";
import { runCustomerInsightEngine } from "@/lib/ai/insights/customerInsightEngine";
import { runCustomerSatisfactionPredictorEngine } from "@/lib/ai/insights/customerSatisfactionPredictorEngine";
import { runInsightReportGeneratorEngine } from "@/lib/ai/insights/insightReportGeneratorEngine";
import { runChurnPredictionEngine } from "@/lib/ai/churn/churnPredictionEngine";
import { runSalesOpportunityDetectorEngine } from "@/lib/ai/sales/salesOpportunityDetectorEngine";
import { runContractOptimizationEngine } from "@/lib/ai/contract/contractOptimizationEngine";
import { runLunchTrendRadarEngine } from "@/lib/ai/radar/lunchTrendRadarEngine";
import { runOperationalBrain } from "@/lib/ai/brain/operationalBrain";
import { runPlatformIntelligenceEngine } from "@/lib/ai/brain/platformIntelligenceEngine";
import { runMenuOptimizerEngine } from "@/lib/ai/menu/menuOptimizerEngine";
import { runMenuPersonalizationEngine } from "@/lib/ai/menu/menuPersonalizationEngine";

/** Domener i lunsj-økosystemet: plattform (hjernen), bestillinger, menyer, kjøkken, levering, kundeanalyse, operasjoner. */
export const LUNCH_ECOSYSTEM_DOMAINS = [
  {
    id: "platform",
    nameNb: "Plattformintelligens",
    nameEn: "Platform Intelligence",
    descriptionNb: "Selve hjernen: samler alle data i én modell, strategiske anbefalinger og vekstmuligheter.",
    descriptionEn: "The brain: aggregates all data in one model, strategic recommendations and growth opportunities.",
    engineIds: ["platform_intelligence"] as const,
  },
  {
    id: "orders",
    nameNb: "Bestillinger",
    nameEn: "Orders",
    descriptionNb: "Prognoser og volum basert på bestillingsdata.",
    descriptionEn: "Forecasts and volume from order data.",
    engineIds: ["demand_forecast"] as const,
  },
  {
    id: "menus",
    nameNb: "Menyer",
    nameEn: "Menus",
    descriptionNb: "Menyoptimalisering, paring, helse, kreativitet, opplevelse.",
    descriptionEn: "Menu optimization, pairing, health, creativity, experience.",
    engineIds: [
      "menu_optimizer",
      "dish_performance",
      "menu_personalization",
      "food_pairing",
      "lunch_health",
      "menu_creativity",
      "lunch_experience",
      "lunch_trend_radar",
      "food_trend_engine",
    ] as const,
  },
  {
    id: "kitchen",
    nameNb: "Kjøkken",
    nameEn: "Kitchen",
    descriptionNb: "Kapasitet, risiko, matsvinn, innkjøp.",
    descriptionEn: "Capacity, risk, waste, procurement.",
    engineIds: [
      "kitchen_load_balancer",
      "kitchen_risk_detector",
      "kitchen_capacity_optimizer",
      "waste_reduction",
      "procurement_advisor",
      "procurement_planner",
    ] as const,
  },
  {
    id: "delivery",
    nameNb: "Levering",
    nameEn: "Delivery",
    descriptionNb: "Ruter og leveringsvinduer.",
    descriptionEn: "Routes and delivery windows.",
    engineIds: ["delivery_route"] as const,
  },
  {
    id: "customer_analysis",
    nameNb: "Kundeanalyse",
    nameEn: "Customer analysis",
    descriptionNb: "Atferd, kultur, innsikt, churn, salgsmuligheter, avtaler.",
    descriptionEn: "Behaviour, culture, insight, churn, sales opportunities, contracts.",
    engineIds: [
      "office_behaviour",
      "office_culture",
      "customer_insight",
      "customer_satisfaction_predictor",
      "churn_prediction",
      "sales_opportunity",
      "contract_optimization",
      "pricing_insight",
      "contract_intelligence",
    ] as const,
  },
  {
    id: "operations",
    nameNb: "Operasjoner",
    nameEn: "Operations",
    descriptionNb: "Daglige operasjonelle anbefalinger og automatiske rapporter.",
    descriptionEn: "Daily operational recommendations and automatic reports.",
    engineIds: ["operational_brain", "insight_report_generator"] as const,
  },
] as const;

export type LunchDomainId = (typeof LUNCH_ECOSYSTEM_DOMAINS)[number]["id"];
export type LunchEngineId =
  | "platform_intelligence"
  | "demand_forecast"
  | "menu_optimizer"
  | "food_pairing"
  | "lunch_health"
  | "menu_creativity"
  | "lunch_experience"
  | "lunch_trend_radar"
  | "kitchen_load_balancer"
  | "kitchen_risk_detector"
  | "waste_reduction"
  | "procurement_advisor"
  | "delivery_route"
  | "delivery_intelligence"
  | "office_behaviour"
  | "office_culture"
  | "customer_insight"
  | "customer_satisfaction_predictor"
  | "churn_prediction"
  | "sales_opportunity"
  | "contract_optimization"
  | "pricing_insight"
  | "contract_intelligence"
  | "operational_brain"
  | "dish_performance"
  | "menu_personalization"
  | "kitchen_capacity_optimizer"
  | "food_trend_engine"
  | "procurement_planner"
  | "insight_report_generator";

type OperationalBrainInput = Parameters<typeof runOperationalBrain>[0];

function toOperationalBrainInput(req: unknown): OperationalBrainInput {
  if (req && typeof req === "object" && "input" in req) {
    const body = req as { input?: unknown };
    const candidate = body.input ?? req;
    return candidate as OperationalBrainInput;
  }
  return req as OperationalBrainInput;
}

const RUNNERS: Record<LunchEngineId, (req: unknown) => unknown> = {
  demand_forecast: (req) =>
    runDemandForecastEngine(req as Parameters<typeof runDemandForecastEngine>[0]),
  menu_optimizer: (req) =>
    runLunchMenuOptimizer(req as Parameters<typeof runLunchMenuOptimizer>[0]),
  dish_performance: (req) =>
    runMenuOptimizerEngine(req as Parameters<typeof runMenuOptimizerEngine>[0]),
  menu_personalization: (req) =>
    runMenuPersonalizationEngine(req as Parameters<typeof runMenuPersonalizationEngine>[0]),
  food_pairing: (req) => runFoodPairingEngine(req as Parameters<typeof runFoodPairingEngine>[0]),
  lunch_health: (req) =>
    runLunchHealthAnalyzerEngine(req as Parameters<typeof runLunchHealthAnalyzerEngine>[0]),
  menu_creativity: (req) =>
    runMenuCreativityEngine(req as Parameters<typeof runMenuCreativityEngine>[0]),
  lunch_experience: (req) =>
    runLunchExperienceDesignerEngine(req as Parameters<typeof runLunchExperienceDesignerEngine>[0]),
  lunch_trend_radar: (req) =>
    runLunchTrendRadarEngine(req as Parameters<typeof runLunchTrendRadarEngine>[0]),
  food_trend_engine: (req) =>
    runLunchTrendRadarEngine(req as Parameters<typeof runLunchTrendRadarEngine>[0]),
  kitchen_load_balancer: (req) =>
    runKitchenLoadBalancerEngine(req as Parameters<typeof runKitchenLoadBalancerEngine>[0]),
  kitchen_risk_detector: (req) =>
    runKitchenRiskDetectorEngine(req as Parameters<typeof runKitchenRiskDetectorEngine>[0]),
  kitchen_capacity_optimizer: (req) =>
    runKitchenCapacityOptimizerEngine(req as Parameters<typeof runKitchenCapacityOptimizerEngine>[0]),
  waste_reduction: (req) =>
    runWasteReductionEngine(req as Parameters<typeof runWasteReductionEngine>[0]),
  procurement_advisor: (req) =>
    runProcurementAdvisorEngine(req as Parameters<typeof runProcurementAdvisorEngine>[0]),
  procurement_planner: (req) =>
    runProcurementAdvisorEngine(req as Parameters<typeof runProcurementAdvisorEngine>[0]),
  delivery_route: (req) =>
    runDeliveryRouteIntelligenceEngine(req as Parameters<typeof runDeliveryRouteIntelligenceEngine>[0]),
  delivery_intelligence: (req) =>
    runDeliveryIntelligenceEngine(req as Parameters<typeof runDeliveryIntelligenceEngine>[0]),
  office_behaviour: (req) =>
    runOfficeBehaviourModel(req as Parameters<typeof runOfficeBehaviourModel>[0]),
  office_culture: (req) =>
    runOfficeCultureAnalyzerEngine(req as Parameters<typeof runOfficeCultureAnalyzerEngine>[0]),
  customer_insight: (req) =>
    runCustomerInsightEngine(req as Parameters<typeof runCustomerInsightEngine>[0]),
  customer_satisfaction_predictor: (req) =>
    runCustomerSatisfactionPredictorEngine(
      req as Parameters<typeof runCustomerSatisfactionPredictorEngine>[0],
    ),
  churn_prediction: (req) =>
    runChurnPredictionEngine(req as Parameters<typeof runChurnPredictionEngine>[0]),
  sales_opportunity: (req) =>
    runSalesOpportunityDetectorEngine(req as Parameters<typeof runSalesOpportunityDetectorEngine>[0]),
  contract_optimization: (req) =>
    runContractOptimizationEngine(req as Parameters<typeof runContractOptimizationEngine>[0]),
  pricing_insight: (req) =>
    runContractOptimizationEngine(req as Parameters<typeof runContractOptimizationEngine>[0]),
  contract_intelligence: (req) =>
    runContractOptimizationEngine(req as Parameters<typeof runContractOptimizationEngine>[0]),
  operational_brain: (req) => runOperationalBrain(toOperationalBrainInput(req)),
  insight_report_generator: (req) =>
    runInsightReportGeneratorEngine(req as Parameters<typeof runInsightReportGeneratorEngine>[0]),
  platform_intelligence: (req) =>
    runPlatformIntelligenceEngine(req as Parameters<typeof runPlatformIntelligenceEngine>[0]),
};

/**
 * Kjører en engine i lunsj-økosystemet.
 * Bruk getEcosystemOverview() for å se tilgjengelige domener og engines.
 */
export function runLunchEcosystem(engineId: LunchEngineId, request: unknown): unknown {
  const run = RUNNERS[engineId];
  if (!run) throw new Error(`Unknown lunch ecosystem engine: ${engineId}`);
  return run(request);
}

/**
 * Returnerer oversikt over lunsj-økosystemet: domener og tilknyttede engines.
 * Sentral hjernen — én kilde til sannhet for hvordan bestillinger, menyer, kjøkken, levering og kundeanalyse henger sammen.
 */
export function getEcosystemOverview(locale: "nb" | "en" = "nb") {
  const isEn = locale === "en";
  return {
    title: isEn ? "AI Lunch Ecosystem Brain" : "AI Lunsj-økosystem-hjerne",
    description: isEn
      ? "Central brain connecting orders, menus, kitchen, delivery, and customer analysis in Lunchportalen."
      : "Sentral hjernen som kobler bestillinger, menyer, kjøkken, levering og kundeanalyse i Lunchportalen.",
    domains: LUNCH_ECOSYSTEM_DOMAINS.map((d) => ({
      id: d.id,
      name: isEn ? d.nameEn : d.nameNb,
      description: isEn ? d.descriptionEn : d.descriptionNb,
      engineIds: [...d.engineIds],
    })),
    engineIds: Object.keys(RUNNERS) as LunchEngineId[],
  };
}

/** Sjekker om en engine-id tilhører lunsj-økosystemet. */
export function isLunchEcosystemEngine(id: string): id is LunchEngineId {
  return id in RUNNERS;
}
