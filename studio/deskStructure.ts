import { CalendarIcon } from "@sanity/icons";
import type { StructureResolver } from "sanity/structure";

import WeekPlannerTool from "./tools/weekPlanner/WeekPlanner";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      // ✅ Ukeplan i venstremenyen
      S.listItem()
        .title("Ukeplan")
        .icon(CalendarIcon)
        .child(S.component(WeekPlannerTool).id("weekPlanner").title("Ukeplan")),

      S.divider(),

      // Resten av dokumenttypene
      ...S.documentTypeListItems(),
    ]);
