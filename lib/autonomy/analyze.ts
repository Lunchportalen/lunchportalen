import { forecastNext } from "@/lib/autonomy/forecast";
import { computeTrend } from "@/lib/autonomy/trends";

export type SystemAnalysis = {
  conversionTrend: number;
  demandTrend: number;
  forecastConversion: number | null;
  forecastOrders: number | null;
};

export function analyzeSystem(series: Record<string, unknown>[]): SystemAnalysis {
  return {
    conversionTrend: computeTrend(series, "conversionRate"),
    demandTrend: computeTrend(series, "orders"),
    forecastConversion: forecastNext(series, "conversionRate"),
    forecastOrders: forecastNext(series, "orders"),
  };
}
