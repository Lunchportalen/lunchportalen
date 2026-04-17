import { describe, expect, it } from "vitest";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";

describe("backofficeSettingsWorkspaceModel", () => {
  it("builds AI governance as a first-class management workspace", () => {
    const model = buildBackofficeManagementWorkspaceModel({
      collectionId: "ai-governance",
      primaryAction: {
        label: "Åpne AI Center",
        href: "/backoffice/ai-control",
        look: "primary",
      },
    });

    expect(model.collection.id).toBe("ai-governance");
    expect(model.collection.honesty).toBe("runtime_read");
    expect(model.routeKind).toBe("workspace");
    expect(model.primaryAction?.href).toBe("/backoffice/ai-control");
  });

  it("preserves collection honesty and detail route kind overrides", () => {
    const model = buildBackofficeManagementWorkspaceModel({
      collectionId: "document-types",
      routeKind: "detail",
      title: "Page",
    });

    expect(model.collection.id).toBe("document-types");
    expect(model.collection.honesty).toBe("code_governed");
    expect(model.routeKind).toBe("detail");
    expect(model.title).toBe("Page");
  });

  it("marks system settings as a runtime-managed workspace", () => {
    const model = buildBackofficeManagementWorkspaceModel({
      collectionId: "system",
    });

    expect(model.collection.objectClass).toBe("system");
    expect(model.collection.honesty).toBe("runtime_managed");
    expect(model.collection.flowKind).toBe("runtime_manage");
  });
});
