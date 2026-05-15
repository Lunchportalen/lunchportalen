import { CalendarIcon, ControlsIcon, DocumentIcon } from "@sanity/icons";
import type { StructureResolver } from "sanity/structure";

import WeekPlannerTool from "./src/tools/WeekPlanner";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Lunchportalen")
    .items([
      S.listItem()
        .title("Ukeplan")
        .icon(CalendarIcon)
        .child(S.component(WeekPlannerTool).id("weekPlanner").title("Ukeplan")),

      S.divider(),

      S.documentTypeListItem("menu")
        .title("Menytyper")
        .icon(ControlsIcon),

      S.documentTypeListItem("closedDate")
        .title("Stengte dager")
        .icon(CalendarIcon),

      S.documentTypeListItem("announcement")
        .title("Driftsmeldinger")
        .icon(DocumentIcon),
    ]);
