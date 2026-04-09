export const INVESTMENT_AREAS = [
  "ACQUISITION",
  "CONVERSION",
  "RETENTION",
  "PRODUCT",
  "CONTENT",
  "INFRASTRUCTURE",
] as const;

export type InvestmentArea = (typeof INVESTMENT_AREAS)[number];
