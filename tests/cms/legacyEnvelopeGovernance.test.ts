import { describe, expect, test } from "vitest";
import {
  previewNormalizeLegacyBodyToEnvelope,
  validateBlockTypesForDocumentTypeAlias,
  validateEditorBlockTypesForGovernedApply,
} from "@/lib/cms/legacyEnvelopeGovernance";

describe("legacyEnvelopeGovernance", () => {
  test("validateBlockTypes allows all editor types for page", () => {
    const r = validateBlockTypesForDocumentTypeAlias("page", ["hero", "richText"]);
    expect(r.ok).toBe(true);
  });

  test("validateEditorBlockTypesForGovernedApply skips when no document type", () => {
    const r = validateEditorBlockTypesForGovernedApply(null, [{ type: "anything" }]);
    expect(r.ok).toBe(true);
  });

  test("previewNormalize rejects when already has documentType", () => {
    const body = {
      documentType: "page",
      fields: {},
      blocksBody: { version: 1, blocks: [] },
    };
    const r = previewNormalizeLegacyBodyToEnvelope("page", body);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toMatch(/allerede/i);
  });

  test("previewNormalize accepts flat legacy blocks", () => {
    const body = { version: 1, blocks: [] };
    const r = previewNormalizeLegacyBodyToEnvelope("page", body);
    expect(r.ok).toBe(true);
  });
});
