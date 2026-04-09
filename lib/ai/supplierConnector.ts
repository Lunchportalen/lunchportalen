/**
 * Grensesnitt mot leverandør — kun simulering / fremtidig integrasjon.
 * INGEN ekte bestillinger i V1.
 */

import { compareSuppliersLive, pickFallbackSupplier } from "@/lib/ai/supplierNetworkEngine";

export type SimulatedQuote = {
  supplierId: string;
  supplierName: string;
  ingredientKey: string;
  unit: "kg";
  unitPriceNok: number | null;
  available: boolean;
  leadTimeDays: number;
  simulated: true;
};

export interface SupplierConnector {
  /** Simuler pris og tilgjengelighet — nettverk kan kobles på senere. */
  simulateQuote(ingredientKey: string): Promise<SimulatedQuote> | SimulatedQuote;
}

/** Fast stub for deterministiske tester og UI. */
export class StubSupplierConnector implements SupplierConnector {
  simulateQuote(ingredientKey: string): SimulatedQuote {
    const base = Math.abs(ingredientKey.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 40) + 40;
    return {
      supplierId: "stub_nordic",
      supplierName: "Simulert leverandør (stub)",
      ingredientKey,
      unit: "kg",
      unitPriceNok: base,
      available: true,
      leadTimeDays: 2,
      simulated: true,
    };
  }
}

/**
 * Multi-leverandør-stub: velger beste simulerte tilbud fra nettverket (additive utvidelse).
 */
export class MultiSupplierStubConnector implements SupplierConnector {
  simulateQuote(ingredientKey: string): SimulatedQuote {
    const best = pickFallbackSupplier(compareSuppliersLive(ingredientKey));
    if (best) return best;
    return new StubSupplierConnector().simulateQuote(ingredientKey);
  }
}
