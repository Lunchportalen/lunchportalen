/**
 * Orchestrator — safe for `npm run evolution:run` (tsx). Do not import from client components.
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeSystem } from "./analyze";
import { applyProposal } from "./apply";
import { decide } from "./decide";
import { testProposal } from "./experiment";
import { persistEvolutionEvent } from "./persist";
import { proposeFix } from "./propose";
import type { EvolutionRunResult, EvolutionStep } from "./types";

export async function runEvolution(root?: string): Promise<EvolutionRunResult> {
  const analysis = analyzeSystem(root ?? process.cwd());
  const steps: EvolutionStep[] = [];

  for (const issue of analysis.issues) {
    const proposal = proposeFix(issue);
    const result = await testProposal(proposal);
    const decision = decide(proposal, result);
    await persistEvolutionEvent({
      proposal,
      result,
      decision,
      issue,
    });
    if (decision === "apply") {
      await applyProposal(proposal);
    }
    steps.push({ issue, proposal, result, decision });
  }

  return { generated_at: new Date().toISOString(), steps };
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) {
  runEvolution()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
