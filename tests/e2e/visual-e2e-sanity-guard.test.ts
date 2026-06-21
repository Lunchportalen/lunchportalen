import { afterEach, describe, expect, test } from "vitest";

import { assertVisualE2eSanityDatasetNotProduction } from "../../e2e/helpers/visual-e2e-sanity-guard";

describe("visual-e2e-sanity-guard", () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  test("rejects production dataset", () => {
    process.env.NEXT_PUBLIC_SANITY_DATASET = "production";
    expect(() => assertVisualE2eSanityDatasetNotProduction()).toThrow(/production blocked/i);
  });

  test("rejects prod alias", () => {
    process.env.NEXT_PUBLIC_SANITY_DATASET = "prod";
    expect(() => assertVisualE2eSanityDatasetNotProduction()).toThrow(/production blocked/i);
  });

  test("accepts staging dataset", () => {
    process.env.NEXT_PUBLIC_SANITY_DATASET = "staging";
    expect(() => assertVisualE2eSanityDatasetNotProduction()).not.toThrow();
  });

  test("fails closed when unset", () => {
    delete process.env.NEXT_PUBLIC_SANITY_DATASET;
    delete process.env.SANITY_DATASET;
    expect(() => assertVisualE2eSanityDatasetNotProduction()).toThrow(/must be set/i);
  });
});
