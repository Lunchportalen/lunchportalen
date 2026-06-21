#!/usr/bin/env node
/**
 * CI Sanity env guards — fail-closed write-safety (mirror uigx-vs-prod Supabase pattern).
 *
 * Modes:
 *   no-production-write — refuse production/prod dataset when any write token is set
 *   non-production        — refuse production/prod dataset (visual / deterministic jobs)
 *   read-only             — refuse any write token (screenshot / read-only jobs)
 */
const FORBIDDEN_PRODUCTION = new Set(["production", "prod"]);

/**
 * @returns {string}
 */
export function resolveSanityDatasetFromEnv() {
  return (
    process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() ||
    process.env.SANITY_DATASET?.trim() ||
    ""
  );
}

/**
 * @returns {boolean}
 */
export function hasSanityWriteTokenInEnv() {
  return Boolean(
    process.env.SANITY_WRITE_TOKEN?.trim() ||
      process.env.SANITY_API_TOKEN?.trim() ||
      process.env.SANITY_TOKEN?.trim(),
  );
}

/**
 * @param {string} dataset
 * @returns {boolean}
 */
export function isProductionSanityDataset(dataset) {
  return FORBIDDEN_PRODUCTION.has(String(dataset).trim().toLowerCase());
}

/**
 * @param {{ label?: string }} [options]
 */
export function assertCiSanityNoProductionWrite(options = {}) {
  const label = options.label ?? "CI";
  const dataset = resolveSanityDatasetFromEnv();
  if (!dataset) {
    throw new Error(`${label} Sanity guard: NEXT_PUBLIC_SANITY_DATASET must be set`);
  }
  if (isProductionSanityDataset(dataset) && hasSanityWriteTokenInEnv()) {
    throw new Error(
      `${label} Sanity guard: refuse production dataset "${dataset}" with write token (4udoq5d8/production write blocked)`,
    );
  }
}

/**
 * @param {{ label?: string }} [options]
 */
export function assertCiSanityNonProductionDataset(options = {}) {
  const label = options.label ?? "CI";
  const dataset = resolveSanityDatasetFromEnv();
  if (!dataset) {
    throw new Error(`${label} Sanity guard: NEXT_PUBLIC_SANITY_DATASET must be set`);
  }
  if (isProductionSanityDataset(dataset)) {
    throw new Error(
      `${label} Sanity guard: refuse production dataset "${dataset}" (use staging for CI/visual)`,
    );
  }
}

/**
 * @param {{ label?: string }} [options]
 */
export function assertCiSanityReadOnly(options = {}) {
  const label = options.label ?? "CI";
  if (hasSanityWriteTokenInEnv()) {
    throw new Error(`${label} Sanity guard: read-only job must not have Sanity write token`);
  }
  assertCiSanityNonProductionDataset({ label });
}

/**
 * @param {string} mode
 * @param {{ label?: string }} [options]
 */
export function runCiSanityGuard(mode, options = {}) {
  switch (mode) {
    case "no-production-write":
      assertCiSanityNoProductionWrite(options);
      return;
    case "non-production":
      assertCiSanityNonProductionDataset(options);
      return;
    case "read-only":
      assertCiSanityReadOnly(options);
      return;
    default:
      throw new Error(`Unknown CI Sanity guard mode: ${mode}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const labelIdx = args.indexOf("--label");
  const label = labelIdx >= 0 ? args[labelIdx + 1] : process.env.CI_SANITY_GUARD_LABEL;
  const modeArgs = args.filter((_, i) => i !== labelIdx && i !== labelIdx + 1);
  const mode = modeArgs[0];

  if (!mode) {
    console.error(
      "Usage: assert-ci-sanity-env.mjs <no-production-write|non-production|read-only> [--label NAME]",
    );
    process.exit(1);
  }

  runCiSanityGuard(mode, { label });
  const dataset = resolveSanityDatasetFromEnv();
  const write = hasSanityWriteTokenInEnv();
  console.log(
    `CI Sanity guard OK (${mode}): dataset=${dataset} writeToken=${write ? "present" : "absent"}`,
  );
}

const isMain = process.argv[1]?.includes("assert-ci-sanity-env.mjs");
if (isMain) {
  main();
}
