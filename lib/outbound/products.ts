/**
 * To produktlinjer — utgående logikk skal ikke blande tilbud uten eksplisitt pivot.
 */

export const products = {
  lunch: {
    name: "Lunchportalen",
    type: "subscription" as const,
  },
  catering: {
    name: "Melhuscatering",
    url: "https://melhuscatering.no",
    type: "on-demand" as const,
  },
} as const;
