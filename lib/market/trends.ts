import type { ExtractedSignals } from "@/lib/market/signalExtract";

export type TrendDatum = {
  signals: { format: ExtractedSignals["format"] };
  engagement: number;
};

/**
 * Deterministisk toppformat etter vektet engasjement (tie-break: alfabetisk format).
 */
export function detectTrends(data: TrendDatum[]): ExtractedSignals["format"] | null {
  const list = Array.isArray(data) ? data : [];
  if (list.length === 0) return null;

  const formats: Record<string, number> = {};
  for (const d of list) {
    const f = d.signals.format;
    formats[f] = (formats[f] ?? 0) + d.engagement;
  }

  const sorted = Object.entries(formats).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "nb");
  });
  const top = sorted[0];
  return top ? (top[0] as ExtractedSignals["format"]) : null;
}
