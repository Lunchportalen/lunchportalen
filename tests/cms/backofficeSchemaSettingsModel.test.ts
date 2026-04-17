import { describe, expect, test } from "vitest";
import {
  countBlockCreateOptions,
  getBlockCreateOptionsForGovernance,
  getDocumentTypeGovernanceSummaries,
  getDocumentTypesForGovernance,
  getFieldKindGovernance,
  getFieldKindUsageSummaries,
  getPropertyEditorSystemModel,
} from "@/lib/cms/backofficeSchemaSettingsModel";
import { EDITOR_BLOCK_CREATE_OPTIONS } from "@/lib/cms/editorBlockCreateOptions";

describe("backofficeSchemaSettingsModel", () => {
  test("document types non-empty", () => {
    expect(getDocumentTypesForGovernance().length).toBeGreaterThan(0);
  });

  test("field kind governance covers known kinds", () => {
    const kinds = getFieldKindGovernance().map((k) => k.kind);
    expect(kinds).toContain("text");
    expect(kinds).toContain("media");
  });

  test("block create options count matches canonical list", () => {
    expect(countBlockCreateOptions()).toBe(EDITOR_BLOCK_CREATE_OPTIONS.length);
    expect(getBlockCreateOptionsForGovernance().length).toBe(EDITOR_BLOCK_CREATE_OPTIONS.length);
  });

  test("property editor system exposes configured instances and ui mappings", () => {
    const model = getPropertyEditorSystemModel();
    expect(model.configuredInstances.length).toBeGreaterThan(0);
    expect(model.uiMappings.length).toBeGreaterThan(0);
  });

  test("document type and kind summaries expose management relationships", () => {
    const documentType = getDocumentTypeGovernanceSummaries()[0];
    const kind = getFieldKindUsageSummaries().find((entry) => entry.kind === "text");
    expect(documentType?.allowedBlockTypeCount).toBeGreaterThan(0);
    expect(documentType?.configuredInstanceCount).toBeGreaterThanOrEqual(0);
    expect(kind?.configuredInstanceCount).toBeGreaterThan(0);
    expect(kind?.documentTypeAliases.length).toBeGreaterThan(0);
  });
});
