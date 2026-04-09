export type AdvantageModel = {
  lastUpdated: number;
  dataPoints: number;
};

export function updateAdvantage(model: AdvantageModel, newData: unknown[]): AdvantageModel {
  const chunk = Array.isArray(newData) ? newData.length : 0;
  return {
    ...model,
    lastUpdated: Date.now(),
    dataPoints: model.dataPoints + chunk,
  };
}
