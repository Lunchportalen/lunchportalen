import type { PlanTier } from "@/lib/cms/menuDayContract";

export const TIER_PRICE_CENTS: Record<PlanTier, number> = {
  BASIS: 9000,
  LUXUS: 13000,
  ENTERPRISE: 17000,
};

export const VAT_RATE = 0.15;
