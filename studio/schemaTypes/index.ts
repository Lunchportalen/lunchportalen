// /studio/schemas/index.ts

import announcement from "./announcement";
import menuContent from "./menuContent";
import menu from "./menu";
import productPlan from "./productPlan";
import weekTemplate from "./weekTemplate";
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
  menu,
  productPlan,
  weekTemplate,
  closedDate,
  page,
  pricingInfo,
];
