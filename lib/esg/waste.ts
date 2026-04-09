// STATUS: KEEP

export type WasteFactors = {
  mealKg: number;              // meal_kg
  co2ePerKgFood: number;       // co2e_per_kg_food
  lateCancelWasteRatio: number; // late_cancel_waste_ratio
  noShowWasteRatio: number;     // no_show_waste_ratio
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function calcWaste(args: {
  cancelledLateCount: number;
  noShowCount: number;
  factors: WasteFactors;
}) {
  const lateR = clamp01(args.factors.lateCancelWasteRatio);
  const nsR = clamp01(args.factors.noShowWasteRatio);

  const wasteMealsRaw = args.cancelledLateCount * lateR + args.noShowCount * nsR;
  const wasteMeals = Math.max(0, Math.round(wasteMealsRaw));

  const wasteKg = Math.max(0, wasteMeals * Math.max(0, args.factors.mealKg));
  const wasteCo2eKg = Math.max(0, wasteKg * Math.max(0, args.factors.co2ePerKgFood));

  return { wasteMeals, wasteKg, wasteCo2eKg };
}
