import "server-only";

import { POLICY } from "@/lib/neural/model";

const LEARNING_RATE = 0.1;

/** Online policy update (additive, bounded by call frequency). */
export function updatePolicy(action: string, reward: number) {
  if (POLICY.weights[action] === undefined) {
    POLICY.weights[action] = 0;
  }
  POLICY.weights[action] += reward * LEARNING_RATE;
}
