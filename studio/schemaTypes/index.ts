// /studio/schemaTypes/index.ts

import announcement from "./announcement";
import menuContent from "./menuContent";
import menu from "./menu";
import productPlan from "./productPlan";
import weekTemplate from "./weekTemplate";
import closedDate from "./closedDate";
import page from "./page";
import pricingInfo from "./pricingInfo";
import mealIdea from "./mealIdea";
import menuDay from "./menuDay";

/**
 * =========================================================
 * SANITY SCHEMA TYPES – LUNCHPORTALEN
 * ---------------------------------------------------------
 * mealIdea:
 *  - Varmmatbank / basebank
 *
 * menuDay:
 *  - Dagkort brukt av WeekPlanner
 *  - Må være registrert fordi WeekPlanner oppretter _type: "menuDay"
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
  mealIdea,
  menuDay,
];