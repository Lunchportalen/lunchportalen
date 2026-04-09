/**
 * Pure, deterministic A/B comparison on revenue (additive helper).
 */
export type ExperimentVariantStats = {
  revenue: number;
};

export type ExperimentEvaluation = {
  winner: "A" | "B";
  uplift: number;
};

export function evaluateExperiment(a: ExperimentVariantStats, b: ExperimentVariantStats): ExperimentEvaluation {
  const ar = Number.isFinite(a.revenue) ? a.revenue : 0;
  const br = Number.isFinite(b.revenue) ? b.revenue : 0;
  return {
    winner: br > ar ? "B" : "A",
    uplift: br - ar,
  };
}

/** Omsetning først, deretter ordre — brukt av revenue-autopilot A/B. */
export type OrderBackedVariantStats = { revenue: number; orders: number };

export function evaluate(
  a: OrderBackedVariantStats,
  b: OrderBackedVariantStats,
): {
  winner: "A" | "B";
  measurement: { revenueDelta: number; ordersDelta: number };
} {
  const ar = Number.isFinite(a.revenue) ? a.revenue : 0;
  const br = Number.isFinite(b.revenue) ? b.revenue : 0;
  const ao = Number.isFinite(a.orders) ? a.orders : 0;
  const bo = Number.isFinite(b.orders) ? b.orders : 0;
  if (br !== ar) {
    return {
      winner: br > ar ? "B" : "A",
      measurement: { revenueDelta: br - ar, ordersDelta: bo - ao },
    };
  }
  return {
    winner: bo > ao ? "B" : "A",
    measurement: { revenueDelta: 0, ordersDelta: bo - ao },
  };
}
