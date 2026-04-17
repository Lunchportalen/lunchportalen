import { describe, expect, it } from "vitest";

import { previewNormalizeLegacyBodyToEnvelope } from "@/lib/cms/legacyEnvelopeGovernance";

/**
 * U28 — Batch bruker samme transform som enkelt-preview; verifiser at tom legacy kan bli envelope.
 */
describe("batchNormalizeLegacy (preview parity)", () => {
  it("previewNormalize aksepterer flat body for page-alias", () => {
    const r = previewNormalizeLegacyBodyToEnvelope("page", { version: 1, blocks: [] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload).toBeDefined();
    }
  });
});
