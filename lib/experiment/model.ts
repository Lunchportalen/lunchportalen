/**
 * Rent datakonstrukt for A/B rundt ett innlegg (kan serialiseres til logg/metadata).
 * Ingen DB-skriving her — brukes sammen med `ab_experiments` / `ai_experiments`.
 */

export type SocialAbExperimentModel = {
  postId: string;
  A: unknown;
  B: unknown;
  split: number;
  startedAt: number;
};

export function createExperiment(postId: string, original: unknown, variant: unknown, split = 0.5): SocialAbExperimentModel {
  return {
    postId,
    A: original,
    B: variant,
    split,
    startedAt: Date.now(),
  };
}
