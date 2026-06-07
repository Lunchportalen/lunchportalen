import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  isTransient,
} from "../../scripts/postdeploy-lib.mjs";

describe("postdeploy isTransient", () => {
  const transient = [0, 403, 404, 408, 425, 429, 500, 502, 503, 504];
  const permanent = [200, 301, 401, 422, 451];

  for (const status of transient) {
    it(`retries HTTP ${status}`, () => {
      expect(isTransient({ status })).toBe(true);
    });
  }

  for (const status of permanent) {
    it(`does not retry HTTP ${status}`, () => {
      expect(isTransient({ status })).toBe(false);
    });
  }

  it("default retry budget covers ~3 min deploy warm-up", () => {
    const maxWaitMs = (DEFAULT_RETRIES - 1) * DEFAULT_RETRY_DELAY_MS;
    expect(maxWaitMs).toBeGreaterThanOrEqual(165_000);
  });
});
