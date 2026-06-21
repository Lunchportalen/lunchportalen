// e2e/helpers/visual-e2e-sanity-guard.ts — Fail-closed Sanity dataset guard for visual E2E jobs

const FORBIDDEN_SANITY_DATASETS = new Set(["production", "prod"]);

/**
 * Visual E2E must never target Sanity `production` (4udoq5d8/production).
 * Screenshot menu content is fixture-stubbed at API boundary; this guard blocks
 * accidental prod dataset in the running Next server env.
 */
export function assertVisualE2eSanityDatasetNotProduction(): void {
  const raw =
    process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() ||
    process.env.SANITY_DATASET?.trim() ||
    "";

  if (!raw) {
    throw new Error(
      "Visual E2E determinism guard: NEXT_PUBLIC_SANITY_DATASET must be set (refuse unset).",
    );
  }

  const dataset = raw.toLowerCase();
  if (FORBIDDEN_SANITY_DATASETS.has(dataset)) {
    throw new Error(
      `Visual E2E determinism guard: refuse Sanity dataset "${raw}" (production blocked for screenshot determinism).`,
    );
  }
}
