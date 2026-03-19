/**
 * AI KITCHEN LOAD BALANCER ENGINE
 * AI balanserer produksjon mellom kjøkken.
 * Hvis flere leverandører finnes kan AI: fordele ordre, redusere flaskehalser.
 */

import { balanceKitchenLoad } from "@/lib/ai/capabilities/kitchenLoadBalancer";
import type {
  KitchenLoadBalancerInput,
  KitchenLoadBalancerOutput,
  KitchenInput,
  KitchenAllocation,
} from "@/lib/ai/capabilities/kitchenLoadBalancer";

export type { KitchenInput, KitchenAllocation };

/** Fordeler ordre på kjøkken for balansert belastning og færre flaskehalser. */
export function balanceLoad(input: KitchenLoadBalancerInput): KitchenLoadBalancerOutput {
  return balanceKitchenLoad(input);
}

export type KitchenLoadBalancerEngineKind = "balance";

export type KitchenLoadBalancerEngineInput = {
  kind: "balance";
  input: KitchenLoadBalancerInput;
};

export type KitchenLoadBalancerEngineResult = {
  kind: "balance";
  data: KitchenLoadBalancerOutput;
};

/**
 * Kjører kitchen load balancer: fordelingsforslag og flaskehalsvarsler.
 */
export function runKitchenLoadBalancerEngine(
  req: KitchenLoadBalancerEngineInput
): KitchenLoadBalancerEngineResult {
  if (req.kind !== "balance") {
    throw new Error(
      `Unknown kitchen load balancer kind: ${(req as KitchenLoadBalancerEngineInput).kind}`
    );
  }
  return {
    kind: "balance",
    data: balanceLoad(req.input),
  };
}
