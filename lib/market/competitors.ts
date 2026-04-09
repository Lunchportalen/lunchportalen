export type CompetitorSnapshot = {
  name: string;
  weakness: string;
};

/**
 * Statisk illustrasjonsanalyse (ingen live markedsdata).
 */
export function analyzeCompetitors(): CompetitorSnapshot[] {
  return [
    { name: "Competitor A", weakness: "begrenset automatisering" },
    { name: "Competitor B", weakness: "fragmentert brukeropplevelse" },
  ];
}
