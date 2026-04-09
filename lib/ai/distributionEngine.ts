/**
 * Fordeling: hvilket kjøkken produserer hva og hvor sending går — kost/tid-heuristikk (deterministisk).
 */

export type KitchenProductionNode = {
  id: string;
  name: string;
  maxPortionsPerDay: number;
  /** Lavere er billigere «driftsindeks». */
  costIndex: number;
};

export type ZoneDemand = {
  zoneId: string;
  label: string;
  portions: number;
};

export type DistributionAssignment = {
  fromKitchenId: string;
  fromKitchenName: string;
  toZoneId: string;
  toZoneLabel: string;
  portions: number;
  rationale: string;
};

export type DistributionPlan = {
  assignments: DistributionAssignment[];
  explain: string[];
  totalCostIndexLoad: number;
};

/**
 * Greedy: soner sortert etter etterspørsel; hvert kjøkken fylles fra lavest costIndex først.
 */
export function optimizeDistribution(kitchens: KitchenProductionNode[], zones: ZoneDemand[]): DistributionPlan {
  const kSorted = [...kitchens].sort((a, b) => a.costIndex - b.costIndex || a.id.localeCompare(b.id));
  const zSorted = [...zones].sort((a, b) => b.portions - a.portions || a.zoneId.localeCompare(b.zoneId));

  const capLeft = new Map(kSorted.map((k) => [k.id, Math.max(0, Math.round(k.maxPortionsPerDay))]));
  const assignments: DistributionAssignment[] = [];
  let totalCostIndexLoad = 0;

  for (const z of zSorted) {
    let need = Math.max(0, Math.round(z.portions));
    if (need === 0) continue;

    for (const k of kSorted) {
      if (need <= 0) break;
      const left = capLeft.get(k.id) ?? 0;
      if (left <= 0) continue;
      const take = Math.min(left, need);
      capLeft.set(k.id, left - take);
      need -= take;
      totalCostIndexLoad += take * k.costIndex;
      assignments.push({
        fromKitchenId: k.id,
        fromKitchenName: k.name,
        toZoneId: z.zoneId,
        toZoneLabel: z.label,
        portions: take,
        rationale: `Tildelt fra ${k.name} (indeks ${k.costIndex}) til ${z.label} — kapasitet igjen ${left - take}.`,
      });
    }
  }

  const explain = [
    "Fordeling er en deterministisk greedy med sortering på kostindeks og synkende sone-etterspørsel.",
    "Ved kapasitetsbrist vil rest-behov vises som udekket i kapasitetstabellen (sjekk kjøkken maxPortionsPerDay).",
  ];

  return { assignments, explain, totalCostIndexLoad };
}
