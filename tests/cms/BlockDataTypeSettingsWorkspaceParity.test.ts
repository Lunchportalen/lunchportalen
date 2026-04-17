import { describe, expect, it } from "vitest";
import { getBlockEditorDataType } from "@/lib/cms/blocks/blockEditorDataTypes";
import {
  buildBlockEditorDataTypeAdminOverrideDiff,
  cloneBlockEditorDataTypeDefinition,
  definitionsEqual,
  stableSerializeBlockEditorDataTypeDefinition,
} from "@/lib/cms/blocks/blockEditorDataTypeWorkspaceModel";

describe("U95 BlockDataTypeSettingsWorkspaceParity", () => {
  it("clone + stable serialize er deterministisk", () => {
    const b = getBlockEditorDataType("compact_page_blocks");
    expect(b).toBeTruthy();
    const c = cloneBlockEditorDataTypeDefinition(b!);
    expect(stableSerializeBlockEditorDataTypeDefinition(c)).toBe(stableSerializeBlockEditorDataTypeDefinition(b!));
  });

  it("definitionsEqual oppdager endret createButtonLabel", () => {
    const b = getBlockEditorDataType("page_micro_blocks");
    expect(b).toBeTruthy();
    const edited = cloneBlockEditorDataTypeDefinition(b!);
    edited.createButtonLabel = "Annen knapp";
    expect(definitionsEqual(b!, edited)).toBe(false);
  });

  it("buildBlockEditorDataTypeAdminOverrideDiff returnerer kun avvik fra kode-baseline", () => {
    const baseline = getBlockEditorDataType("compact_page_blocks");
    expect(baseline).toBeTruthy();
    const edited = cloneBlockEditorDataTypeDefinition(baseline!);
    edited.title = "Overstyrt tittel";
    const diff = buildBlockEditorDataTypeAdminOverrideDiff(baseline!, edited);
    expect(diff.title).toBe("Overstyrt tittel");
    expect(diff.maxItems).toBeUndefined();
  });
});
