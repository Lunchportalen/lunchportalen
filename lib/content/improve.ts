import type { ExtractedSignals } from "@/lib/market/signalExtract";

export type ImprovableContent = { text: string; [key: string]: unknown };

/**
 * Forbedrer eget utkast ut fra signaler — ikke blind duplikasjon.
 */
export function improveContent(base: ImprovableContent, signals: ExtractedSignals): ImprovableContent {
  let improved = String(base.text ?? "");

  if (!signals.hasCTA) {
    improved += "\n\nBook demo →";
  }

  if (signals.emotionalWords < 2) {
    improved = "Opplev ekte kvalitet.\n\n" + improved;
  }

  return {
    ...base,
    text: improved,
  };
}
