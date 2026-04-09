/**
 * Harde profit-first rammer — ufravikelige terskler for skalering og kapitalkontroll.
 */

export const guardrails = {
  minROAS: 2.0,
  minMargin: 0.3,

  maxDailyBudget: 5000,
  maxAccountBudget: 20000,

  maxDailyChange: 0.25,

  killSwitchROAS: 0.8,
  killSwitchSpend: 500,

  /** Portfolio ROAS under dette → reduser alle budsjetter (forslag, ikke auto-exec). */
  portfolioRoasReduceAllBelow: 1.5,
  /** Portfolio ROAS over dette → multi-account skalering tillatt i planleggeren. */
  portfolioRoasAllowAggressiveScaleAbove: 3,
  /** Minimum ROAS for «vinner» på tvers av kontoer (strengere enn enkeltkampanje minROAS). */
  minRoasForMultiAccountScale: 3,
  /** Maks andel av total porteføljebudsjett per kampanje (diversifisering). */
  maxBudgetSharePerCampaign: 0.4,
} as const;
