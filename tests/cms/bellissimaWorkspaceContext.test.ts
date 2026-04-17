import { describe, expect, it, vi } from "vitest";
import {
  buildContentBellissimaWorkspaceModel,
  buildContentBellissimaWorkspaceSnapshot,
  buildContentSectionBellissimaWorkspaceSnapshot,
} from "@/lib/cms/backofficeWorkspaceContextModel";

describe("content bellissima workspace model", () => {
  it("bygger entity-workspace med view actions og footer apps", async () => {
    const setActiveView = vi.fn();
    const model = buildContentBellissimaWorkspaceModel(
      buildContentBellissimaWorkspaceSnapshot({
        pageId: "page-1",
        title: "Forside",
        slug: "forside",
        documentTypeAlias: "page",
        statusLabel: "published",
        canvasMode: "edit",
        saveState: "lagret",
        dirty: false,
        canSave: true,
        canPublish: true,
        canUnpublish: true,
        canPreview: true,
        canOpenPublic: true,
        activeWorkspaceView: "content",
        auditLogDegraded: false,
      }),
      {
        setActiveView,
        actionHandlers: {
          save: vi.fn(),
          publish: vi.fn(),
          unpublish: vi.fn(),
        },
        previewDevice: "mobile",
        previewLayoutMode: "full",
        showPreviewColumn: true,
      },
    );

    expect(model.views.map((view) => view.id)).toEqual([
      "content",
      "preview",
      "history",
      "global",
      "design",
    ]);
    expect(model.sideApps.map((app) => app.id)).toEqual([
      "workspace",
      "ai",
      "runtime",
    ]);
    expect(model.inspectorSections.map((section) => section.id)).toEqual([
      "content",
      "design",
      "seo",
      "governance",
      "runtime",
    ]);
    expect(model.primaryActions.map((action) => action.id)).toContain("save");
    expect(model.primaryActions.map((action) => action.id)).not.toContain("publish");
    expect(model.footerApps.some((app) => app.id === "document_type")).toBe(true);
    expect(
      model.entityActions.find((action) => action.id === "public_page")?.href,
    ).toBe("/forside");
    expect(model.footerApps.some((app) => app.id === "publish_state")).toBe(true);
    expect(model.footerApps.find((app) => app.id === "history")?.value).toBe("Historikk klar");
    expect(model.footerApps.find((app) => app.id === "runtime")?.value).toBe("Redaksjonell kontroll");
    expect(model.footerApps.find((app) => app.id === "governance")?.value).toContain("Envelope");
    expect(model.footerApps.find((app) => app.id === "inspector")?.value).toBe("Innhold");

    const historyAction = model.entityActions.find((action) => action.id === "history");
    expect(historyAction).toBeTruthy();
    await historyAction?.onSelect?.();
    expect(setActiveView).toHaveBeenCalledWith("history");
  });

  it("viser publish i primærlisten for kladd selv når canPublish er false (f.eks. dirty), men knappen er disabled", () => {
    const model = buildContentBellissimaWorkspaceModel(
      buildContentBellissimaWorkspaceSnapshot({
        pageId: "page-2",
        title: "Utkastside",
        slug: "utkast",
        documentTypeAlias: "page",
        statusLabel: "draft",
        canvasMode: "edit",
        saveState: "lagret",
        dirty: true,
        canSave: true,
        canPublish: false,
        canUnpublish: false,
        canPreview: true,
        canOpenPublic: false,
        activeWorkspaceView: "content",
        auditLogDegraded: false,
      }),
      {},
    );
    const ids = model.primaryActions.map((a) => a.id);
    expect(ids).toContain("publish");
    expect(ids).toContain("save");
    expect(ids).toContain("preview");
    expect(model.primaryActions.find((a) => a.id === "publish")?.enabled).toBe(false);
  });

  it("bygger section-workspace med create action og content tabs", async () => {
    const create = vi.fn();
    const model = buildContentBellissimaWorkspaceModel(
      buildContentSectionBellissimaWorkspaceSnapshot({
        viewId: "overview",
        title: "Innhold",
        primaryActionIds: ["create"],
        secondaryActionIds: ["settings"],
        actionAvailability: { create: true },
      }),
      {
        actionHandlers: {
          create,
        },
      },
    );

    expect(model.views.map((view) => view.id)).toEqual([
      "overview",
      "growth",
      "recycle-bin",
    ]);
    expect(model.sideApps.map((app) => app.id)).toEqual(["workspace"]);
    expect(model.inspectorSections).toEqual([]);
    expect(model.primaryActions.map((action) => action.id)).toEqual(["create"]);
    expect(model.footerApps.some((app) => app.value === "Tree først")).toBe(true);

    await model.primaryActions[0]?.onSelect?.();
    expect(create).toHaveBeenCalledTimes(1);
  });
});