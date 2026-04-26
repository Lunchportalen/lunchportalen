import { CalendarIcon, ComposeIcon, ControlsIcon, DocumentIcon } from "@sanity/icons";
import type { StructureResolver } from "sanity/structure";

import WeekPlannerTool from "./tools/weekPlanner/WeekPlanner";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Lunchportalen")
    .items([
      S.listItem()
        .title("Ukeplan")
        .icon(CalendarIcon)
        .child(S.component(WeekPlannerTool).id("weekPlanner").title("Ukeplan")),

      S.divider(),

      S.documentTypeListItem("menuContent")
        .title("Menyinnhold")
        .icon(ComposeIcon),

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
