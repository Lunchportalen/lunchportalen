import "server-only";

import { shouldFail } from "@/lib/chaos/engine";

/**
 * Deterministisk feilinjeksjon når CHAOS_MODE=true (samme modell som shouldFail — ingen Math.random).
 */
export function chaosInject(probability = 0.1, key = "chaos_inject"): void {
  if (shouldFail(probability, key)) {
    throw {
      code: "CHAOS",
      message: "Injected failure",
      source: "chaos",
      severity: "low",
    };
  }
}

/** Alias (prompt-kompatibel signatur). */
export function chaos(probability = 0.1, key = "chaos_default"): void {
  chaosInject(probability, key);
}
