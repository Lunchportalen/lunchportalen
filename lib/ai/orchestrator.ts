/**
 * AI ORCHESTRATION ENGINE — hjernen.
 * Bestemmer: hvilken AI som kjøres, i hvilken rekkefølge, med hvilken kontekst, hvordan resultat brukes.
 * Uten denne blir AI bare mange tilfeldige verktøy.
 */

import { runGrowthEngine } from "@/lib/ai/growth/growthEngine";
import type { GrowthEngineInput, GrowthEngineResult } from "@/lib/ai/growth/growthEngine";
import { runHealthEngine } from "@/lib/ai/health/healthEngine";
import type { HealthEngineInput, HealthEngineResult } from "@/lib/ai/health/healthEngine";
import { runGovernanceEngine } from "@/lib/ai/governance/governanceEngine";
import type { GovernanceEngineInput, GovernanceEngineResult } from "@/lib/ai/governance/governanceEngine";
import { runStrategicEngine } from "@/lib/ai/strategic/strategicEngine";
import type { StrategicEngineInput, StrategicEngineResult } from "@/lib/ai/strategic/strategicEngine";
import { runMarketingEngine } from "@/lib/ai/marketing/marketingEngine";
import type { MarketingEngineInput, MarketingEngineResult } from "@/lib/ai/marketing/marketingEngine";
import { runTrafficEngine } from "@/lib/ai/traffic/trafficEngine";
import type { TrafficEngineInput, TrafficEngineResult } from "@/lib/ai/traffic/trafficEngine";
import { runExperimentEngine } from "@/lib/ai/experiments/experimentEngine";
import type { ExperimentEngineInput, ExperimentEngineResult } from "@/lib/ai/experiments/experimentEngine";

/** Alle kjente engine-id'er. */
export const ENGINE_IDS = [
  "growth",
  "health",
  "governance",
  "strategic",
  "marketing",
  "traffic",
  "experiments",
] as const;

export type EngineId = (typeof ENGINE_IDS)[number];

/** Kontekst som flyter gjennom pipelinen. Resultat fra hver steg lagres under stepId. */
export type OrchestratorContext = Record<string, unknown>;

/** Én steg i en pipeline: hvilken engine, hva som kjøres, hvor resultat lagres. */
export type PipelineStep = {
  /** Unik id for dette steget; resultat lagres i context[stepId]. */
  id: string;
  /** Hvilken engine som kjøres. */
  engine: EngineId;
  /** Request til engine: enten fast objekt eller funksjon som tar kontekst og returnerer request. */
  request: unknown | ((context: OrchestratorContext) => unknown);
};

/** Resultat fra én kjøring av en engine. */
export type EngineRunResult =
  | { engine: "growth"; data: GrowthEngineResult }
  | { engine: "health"; data: HealthEngineResult }
  | { engine: "governance"; data: GovernanceEngineResult }
  | { engine: "strategic"; data: StrategicEngineResult }
  | { engine: "marketing"; data: MarketingEngineResult }
  | { engine: "traffic"; data: TrafficEngineResult }
  | { engine: "experiments"; data: ExperimentEngineResult };

/** Resultat fra et pipeline-steg. Ved feil er result undefined og error satt. */
export type StepResult = {
  stepId: string;
  engine: EngineId;
  result?: EngineRunResult;
  error?: string;
};

/** Full pipeline-kjøring: kontekst etter alle steg + resultat per steg. */
export type PipelineResult = {
  context: OrchestratorContext;
  results: StepResult[];
  completed: number;
  failed: number;
};

type EngineRunner = (req: unknown) => unknown;

const registry = new Map<EngineId, EngineRunner>();

function register<E extends EngineId>(id: E, run: (req: unknown) => unknown): void {
  registry.set(id, run);
}

/** Registrerer alle kjente engines. */
function registerAll(): void {
  register("growth", (req) => runGrowthEngine(req as GrowthEngineInput));
  register("health", (req) => runHealthEngine(req as HealthEngineInput));
  register("governance", (req) => runGovernanceEngine(req as GovernanceEngineInput));
  register("strategic", (req) => runStrategicEngine(req as StrategicEngineInput));
  register("marketing", (req) => runMarketingEngine(req as MarketingEngineInput));
  register("traffic", (req) => runTrafficEngine(req as TrafficEngineInput));
  register("experiments", (req) => runExperimentEngine(req as ExperimentEngineInput));
}

registerAll();

/**
 * Kjører én engine med gitt request.
 * Kaster hvis engine er ukjent eller request er ugyldig.
 */
export function runEngine(engineId: EngineId, request: unknown): EngineRunResult {
  const run = registry.get(engineId);
  if (!run) throw new Error(`Unknown engine: ${engineId}`);
  const raw = run(request);

  switch (engineId) {
    case "growth":
      return { engine: "growth", data: raw as GrowthEngineResult };
    case "health":
      return { engine: "health", data: raw as HealthEngineResult };
    case "governance":
      return { engine: "governance", data: raw as GovernanceEngineResult };
    case "strategic":
      return { engine: "strategic", data: raw as StrategicEngineResult };
    case "marketing":
      return { engine: "marketing", data: raw as MarketingEngineResult };
    case "traffic":
      return { engine: "traffic", data: raw as TrafficEngineResult };
    case "experiments":
      return { engine: "experiments", data: raw as ExperimentEngineResult };
    default: {
      // Should be unreachable because EngineId is exhaustive
      throw new Error(`Unhandled engine id: ${engineId satisfies never}`);
    }
  }
}

/**
 * Kjører en pipeline av steg i rekkefølge.
 * Kontekst brukes til å bygge request (når request er en funksjon) og til å lagre hvert stegs resultat under stepId.
 * Slik bestemmer orchestrator: hvilken AI som kjøres, i hvilken rekkefølge, med hvilken kontekst, og hvordan resultat brukes (context[stepId]).
 *
 * Eksempel: strategi først, deretter vekst med kontekst fra strategi:
 *   runPipeline([
 *     { id: "direction", engine: "strategic", request: { kind: "platform_direction", input: { goals: ["Vekst"] } } },
 *     { id: "growth", engine: "growth", request: (ctx) => ({ kind: "opportunities", input: { seedKeywords: ... } }) },
 *   ], { locale: "nb" })
 */
export function runPipeline(
  steps: PipelineStep[],
  initialContext: OrchestratorContext = {}
): PipelineResult {
  const context: OrchestratorContext = { ...initialContext };
  const results: StepResult[] = [];
  let completed = 0;
  let failed = 0;

  for (const step of steps) {
    const request =
      typeof step.request === "function" ? (step.request as (ctx: OrchestratorContext) => unknown)(context) : step.request;
    try {
      const runResult = runEngine(step.engine, request);
      context[step.id] = runResult.data;
      results.push({ stepId: step.id, engine: step.engine, result: runResult });
      completed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ stepId: step.id, engine: step.engine, error: message });
      failed++;
    }
  }

  return { context, results, completed, failed };
}

/** Returnerer om en engine-id er registrert. */
export function hasEngine(engineId: string): engineId is EngineId {
  return ENGINE_IDS.includes(engineId as EngineId);
}

/** Lister alle tilgjengelige engine-id'er. */
export function listEngines(): EngineId[] {
  return [...ENGINE_IDS];
}
