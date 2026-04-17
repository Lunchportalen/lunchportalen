import { describe, expect, it } from "vitest";

import {
  buildContentBellissimaWorkspaceSnapshot,
  buildContentBellissimaWorkspaceModel,
  contentGovernedPostureLabel,
  workspaceLifecycleLabel,
  type WorkspaceLifecycleHint,
} from "@/lib/cms/backofficeWorkspaceContextModel";

describe("backofficeWorkspaceContextModel (U21)", () => {
  it("workspaceLifecycleLabel maps hints", () => {
    const cases: Array<[WorkspaceLifecycleHint, string]> = [
      ["draft", "Utkast"],
      ["published", "Publisert"],
      ["preview", "Forhåndsvisning"],
      ["unknown", "Ukjent livssyklus"],
    ];
    for (const [h, label] of cases) {
      expect(workspaceLifecycleLabel(h)).toBe(label);
    }
  });
});

describe("backofficeWorkspaceContextModel (U32 Bellissima model)", () => {
  it("buildContentBellissimaWorkspaceSnapshot binds manifest ids and lifecycle", () => {
    const s = buildContentBellissimaWorkspaceSnapshot({
      pageId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Forside",
      slug: "forside",
      documentTypeAlias: "contentPage",
      statusLabel: "draft",
      canvasMode: "edit",
      saveState: "dirty",
      dirty: true,
    });
    expect(s.extensionId).toBe("nav.content");
    expect(s.workspaceId).toBe("content-editor");
    expect(s.collectionKey).toBe("contentTree");
    expect(s.entityId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(s.documentTypeAlias).toBe("contentPage");
    expect(s.publishState).toBe("draft");
    expect(s.canvasMode).toBe("edit");
    expect(s.editorSaveState).toBe("dirty");
    expect(s.dirty).toBe(true);
    expect(s.lifecycle).toBe("draft");
    expect(s.auditLogDegraded).toBe(null);
    expect(s.governedPosture).toBe("envelope");
    expect(s.activeWorkspaceView).toBe("content");
  });

  it("buildContentBellissimaWorkspaceModel exposes explicit views, actions, and footer apps", () => {
    const snapshot = buildContentBellissimaWorkspaceSnapshot({
      pageId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Forside",
      slug: "forside",
      documentTypeAlias: "contentPage",
      statusLabel: "published",
      canvasMode: "edit",
      saveState: "saved",
      dirty: false,
      auditLogDegraded: false,
      activeWorkspaceView: "history",
    });
    const model = buildContentBellissimaWorkspaceModel(snapshot);

    expect(model.views.map((view) => view.id)).toEqual(["content", "preview", "history", "global", "design"]);
    expect(model.views.find((view) => view.id === "history")?.active).toBe(true);
    expect(model.primaryActions.map((action) => action.id)).toEqual(["save", "preview"]);
    expect(model.secondaryActions.map((action) => action.id)).toEqual([
      "history",
      "settings",
      "public_page",
      "unpublish",
    ]);
    expect(model.entityActions.map((action) => action.id)).toEqual([
      "edit",
      "preview",
      "history",
      "management",
      "schema",
      "settings",
      "public_page",
    ]);
    expect(model.footerApps.find((app) => app.id === "history")?.value).toBe("Historikk klar");
    expect(model.footerApps.find((app) => app.id === "document_type")?.href).toBe(
      "/backoffice/settings/document-types/contentPage",
    );
    expect(model.footerApps.find((app) => app.id === "schema_shortcut")?.href).toBe(
      "/backoffice/settings/schema",
    );
    expect(model.footerApps.find((app) => app.id === "settings_shortcut")?.href).toBe("/backoffice/settings");
  });

  it("contentGovernedPostureLabel maps posture", () => {
    expect(contentGovernedPostureLabel("envelope")).toContain("Envelope");
    expect(contentGovernedPostureLabel("legacy")).toContain("Legacy");
    expect(contentGovernedPostureLabel("unknown")).toContain("Ukjent");
  });

  it("passes audit degraded when provided", () => {
    const s = buildContentBellissimaWorkspaceSnapshot({
      pageId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Forside",
      slug: "forside",
      documentTypeAlias: "contentPage",
      statusLabel: "draft",
      canvasMode: "edit",
      saveState: "saved",
      dirty: false,
      auditLogDegraded: true,
    });
    expect(s.auditLogDegraded).toBe(true);
    expect(s.governedPosture).toBe("envelope");
  });

  it("infers legacy posture when no document type", () => {
    const s = buildContentBellissimaWorkspaceSnapshot({
      pageId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Uten type",
      slug: "uten-type",
      documentTypeAlias: null,
      statusLabel: "draft",
      canvasMode: "edit",
      saveState: "saved",
      dirty: false,
    });
    expect(s.governedPosture).toBe("legacy");
  });

  it("preview canvas forces preview lifecycle", () => {
    const s = buildContentBellissimaWorkspaceSnapshot({
      pageId: "a",
      title: "Previewside",
      slug: "previewside",
      documentTypeAlias: null,
      statusLabel: "published",
      canvasMode: "preview",
      saveState: "saved",
      dirty: false,
    });
    expect(s.lifecycle).toBe("preview");
    expect(s.auditLogDegraded).toBe(null);
    expect(s.governedPosture).toBe("legacy");
  });
});
