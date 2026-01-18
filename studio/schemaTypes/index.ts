// /studio/schemas/index.ts

import announcement from "./announcement";
import menuContent from "./menuContent";
import closedDate from "./closedDate";
import page from "./page";
import pricingInfo from "./pricingInfo";

/**
 * =========================================================
 * SANITY SCHEMA TYPES – LUNCHPORTALEN (FASET)
 * ---------------------------------------------------------
 * menuContent:
 *  - Dag-basert meny
 *  - Manuell godkjenning (approvedForPublish)
 *  - Automatisk kundesynlighet (customerVisible via cron)
 * =========================================================
 */
export const schemaTypes = [
  announcement,
  menuContent,
  closedDate,
  page,
  pricingInfo,
];
