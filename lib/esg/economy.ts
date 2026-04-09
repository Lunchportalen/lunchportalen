// STATUS: KEEP

export function calcEconomy(args: {
  orderedCount: number;
  cancelledInTimeCount: number;
  wasteMeals: number;
  mealPriceNok: number;
}) {
  const p = Math.max(0, Number(args.mealPriceNok) || 0);

  const costOrdered = Math.max(0, args.orderedCount * p);
  const costSaved = Math.max(0, args.cancelledInTimeCount * p);
  const costWaste = Math.max(0, args.wasteMeals * p);

  const costNet = Math.max(0, costOrdered - costSaved);

  return {
    costOrderedNok: costOrdered,
    costSavedNok: costSaved,
    costWasteNok: costWaste,
    costNetNok: costNet,
  };
}
