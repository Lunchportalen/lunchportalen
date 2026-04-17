import { describe, expect, it } from "vitest";

import {
  BACKOFFICE_NAV_ITEMS,
  BACKOFFICE_SETTINGS_BASE_PATH,
  BACKOFFICE_SETTINGS_COLLECTIONS,
  BACKOFFICE_SETTINGS_EXTENSION_ID,
  BACKOFFICE_SETTINGS_WORKSPACE_VIEWS,
} from "@/lib/cms/backofficeExtensionRegistry";
import {
  getDocumentTypeGovernanceSummaries,
  getFieldKindUsageSummaries,
  getPropertyEditorFlowForDocumentType,
  getPropertyEditorSystemModel,
} from "@/lib/cms/backofficeSchemaSettingsModel";

describe("U29 settings workspaces (data presence)", () => {
  it("document types collection har minst én rad", () => {
    expect(getDocumentTypeGovernanceSummaries().length).toBeGreaterThan(0);
  });
  it("data types collection har felt-kinds", () => {
    expect(getFieldKindUsageSummaries().length).toBeGreaterThan(0);
  });
  it("schema workspace har property editor-systemmodell", () => {
    const model = getPropertyEditorSystemModel();
    expect(model.configuredInstances.length).toBeGreaterThan(0);
    expect(model.uiMappings.length).toBeGreaterThan(0);
  });

  it("document type flow binder schema, configured instances og UI-mapping", () => {
    const first = getDocumentTypeGovernanceSummaries()[0];
    const flow = getPropertyEditorFlowForDocumentType(first.alias);
    expect(flow?.documentType?.alias).toBe(first.alias);
    expect(flow?.configuredInstances.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(flow?.uiMappings)).toBe(true);
  });
});

describe("U29R — kanonisk settings-path", () => {
  it("nav.settings peker på BACKOFFICE_SETTINGS_BASE_PATH", () => {
    const entry = BACKOFFICE_NAV_ITEMS.find((i) => i.extensionId === BACKOFFICE_SETTINGS_EXTENSION_ID);
    expect(entry?.href).toBe(BACKOFFICE_SETTINGS_BASE_PATH);
    expect(BACKOFFICE_SETTINGS_BASE_PATH).toBe("/backoffice/settings");
  });

  it("workspace view-faner avledes direkte fra collection-registry", () => {
    expect(BACKOFFICE_SETTINGS_WORKSPACE_VIEWS).toHaveLength(BACKOFFICE_SETTINGS_COLLECTIONS.length);
    expect(BACKOFFICE_SETTINGS_WORKSPACE_VIEWS.map((entry) => entry.id)).toEqual(
      BACKOFFICE_SETTINGS_COLLECTIONS.map((entry) => entry.id),
    );
    expect(BACKOFFICE_SETTINGS_WORKSPACE_VIEWS.map((entry) => entry.href)).toEqual(
      BACKOFFICE_SETTINGS_COLLECTIONS.map((entry) => entry.href),
    );
  });
});
