// /studio/schemaTypes/index.ts

import announcement from "./announcement";
import menu from "./menu";
import productPlan from "./productPlan";
import weekTemplate from "./weekTemplate";
import closedDate from "./closedDate";
import page from "./page";
import pricingInfo from "./pricingInfo";
import lunchCategory from "./lunchCategory";
import mealIdea from "./mealIdea";
import menuDay from "./menuDay";

/**
 * =========================================================
 * SANITY SCHEMA TYPES – LUNCHPORTALEN
 * ---------------------------------------------------------
 * mealIdea:
 *  - Varmmatbank / basebank
 *
 * lunchCategory:
 *  - Kanonisk statisk kategoriinnhold (påsmurt, salatboks, …)
 *
 * menuDay:
 *  - Dagkort brukt av WeekPlanner
 *  - Må være registrert fordi WeekPlanner oppretter _type: "menuDay"
 * =========================================================
 */
export const schemaTypes = [
  announcement,
  menu,
  productPlan,
  weekTemplate,
  closedDate,
  page,
  pricingInfo,
  lunchCategory,
  mealIdea,
  menuDay,
];