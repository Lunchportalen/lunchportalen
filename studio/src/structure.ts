import { StructureBuilder } from "sanity/structure";
import WeekPlanner from "./tools/WeekPlanner";

export const structure = (S: StructureBuilder) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Ukeplan")
        .child(S.component(WeekPlanner).title("Ukeplan")),

      // resten av innholdet deres…
      ...S.documentTypeListItems().filter(
        (item) => !["menuDay"].includes(item.getId() || "")
      ),

      S.divider(),
      S.documentTypeListItem("menuDay").title("Meny – Dager"),
    ]);
