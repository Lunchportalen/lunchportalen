import "server-only";



import type { DemoCtaWeights } from "@/lib/public/demoCtaAb/weights";

import {

  clampDemoCtaWeightsForKeys,

  normalizeDemoCtaWeightsForKeys,

} from "@/lib/public/demoCtaAb/weights";



import { DEMO_CTA_AB_WEIGHT_FLOOR } from "@/lib/public/demoCtaAb/config";



/** Utforskning: høy når få visninger i bucket; lavere når historikk er skarp (sterk vinner). */

export function demoAbExplorationEpsilon(contextImp: number, dominantWeight: number): number {

  const base = Math.min(0.28, Math.max(0.06, 0.34 / Math.sqrt(1 + contextImp / 26)));

  const sharpPattern = dominantWeight >= 0.64;

  return sharpPattern ? base * 0.85 : base;

}

/**
 * Bruker lagret `exploration_rate` fra rebalance når tilgjengelig; ellers legacy ε(context).
 */
export function resolveDemoAbExplorationEpsilon(params: {
  contextImp: number;
  dominantWeight: number;
  storedRate?: number | null;
}): number {
  const r = params.storedRate;
  if (typeof r === "number" && Number.isFinite(r)) {
    return Math.max(0.04, Math.min(0.36, r));
  }
  return demoAbExplorationEpsilon(params.contextImp, params.dominantWeight);
}

/** Blander global sannhet med kontekst-spesifikk læring (stoler mer på kontekst når n↑). */

export function mixGlobalWithContextLearned(

  global: DemoCtaWeights,

  contextLearned: DemoCtaWeights | null,

  contextImp: number,

  keys: string[],

): DemoCtaWeights {

  const trust = 1 - Math.exp(-contextImp / 110);

  if (!contextLearned) return normalizeDemoCtaWeightsForKeys(global, keys);

  const mixed: DemoCtaWeights = {};

  for (const k of keys) {

    mixed[k] = trust * (contextLearned[k] ?? 0) + (1 - trust) * (global[k] ?? 0);

  }

  return normalizeDemoCtaWeightsForKeys(mixed, keys);

}



/** Legger uniform støy (utforskning) oppå prior. */

export function applyExplorationToPrior(prior: DemoCtaWeights, epsilon: number, keys: string[]): DemoCtaWeights {

  const n = Math.max(1, keys.length);

  const u = 1 / n;

  const out: DemoCtaWeights = {};

  for (const k of keys) {

    out[k] = (1 - epsilon) * (prior[k] ?? 0) + epsilon * u;

  }

  return clampDemoCtaWeightsForKeys(

    normalizeDemoCtaWeightsForKeys(out, keys),

    keys,

    DEMO_CTA_AB_WEIGHT_FLOOR,

  );

}


