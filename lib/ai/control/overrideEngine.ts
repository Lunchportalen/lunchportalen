export type AiControlOverride = {
  disableExperiments: boolean;
  disableOptimization: boolean;
};

export function getOverride(): AiControlOverride {
  return {
    disableExperiments: process.env.AI_DISABLE_EXPERIMENTS === "true",
    disableOptimization: process.env.AI_DISABLE_OPTIMIZER === "true",
  };
}
