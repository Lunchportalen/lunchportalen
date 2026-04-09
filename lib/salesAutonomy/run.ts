import "server-only";

import type { AnalyzeBusinessInput } from "@/lib/ceo/engine";
import { loadCeoEngineInputs } from "@/lib/ceo/loadEngineInputs";
import type { CeoEngineRunResult } from "@/lib/ceo/run";
import { runCeoEngine } from "@/lib/ceo/run";
import { resolveAutonomyConfig, isAutonomyEnvUnlocked } from "@/lib/salesAutonomy/config";
import { simulateExecution } from "@/lib/salesAutonomy/dryRun";
import { executePreparedActions } from "@/lib/salesAutonomy/salesAgentExecute";
import { buildPreparedActions } from "@/lib/salesAutonomy/plan";
import type { AutonomousRunOutput, AutonomyRuntimeConfig } from "@/lib/salesAutonomy/types";
import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";

export type AutonomousModeOptions = {
  input?: AnalyzeBusinessInput;
  configOverrides?: Partial<AutonomyRuntimeConfig>;
  approvedActionIds?: string[];
  idempotencyKey?: string | null;
  actorEmail?: string | null;
};

export type AutonomousModeResult = AutonomousRunOutput & { ceo: CeoEngineRunResult };

export async function runAutonomousMode(opts: AutonomousModeOptions): Promise<AutonomousModeResult> {
  const input = opts.input ?? (await loadCeoEngineInputs());
  const deals = (input.pipeline?.dealsList ?? []) as EnrichedPipelineDeal[];
  const config = resolveAutonomyConfig(opts.configOverrides);
  const ceo = runCeoEngine(input);

  const approved = new Set(
    Array.isArray(opts.approvedActionIds)
      ? opts.approvedActionIds.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [],
  );

  const maxLeadsPerAction = Math.min(config.maxActionsPerRun, 10);
  const prepared = buildPreparedActions(ceo, deals, approved, config.maxActionsPerRun, maxLeadsPerAction);

  const envUnlocked = isAutonomyEnvUnlocked();
  const shouldSimulateOnly = !envUnlocked || !config.enabled || config.mode === "dry-run";

  if (shouldSimulateOnly) {
    return {
      simulated: true,
      config,
      prepared,
      results: simulateExecution(prepared),
      envUnlocked,
      ceo,
    };
  }

  const results = await executePreparedActions(prepared, {
    config,
    idempotencyKey: opts.idempotencyKey ?? "",
    actorEmail: opts.actorEmail ?? null,
  });

  return {
    simulated: false,
    config,
    prepared,
    results,
    envUnlocked,
    ceo,
  };
}
