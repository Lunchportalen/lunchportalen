/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentBellissimaWorkspaceProvider,
  useBellissimaEntityWorkspacePublisher,
  useBellissimaEntityWorkspaceViewState,
  useBellissimaWorkspaceModel,
  useBellissimaWorkspaceShellState,
} from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import {
  buildContentBellissimaWorkspaceSnapshot,
  contentInspectorSectionLabel,
  contentWorkspaceSideAppLabel,
  contentWorkspaceViewLabel,
} from "@/lib/cms/backofficeWorkspaceContextModel";

(global as typeof globalThis & { React?: unknown }).React = require("react");
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Probe = {
  publish: ReturnType<typeof useBellissimaEntityWorkspacePublisher>;
  model: ReturnType<typeof useBellissimaWorkspaceModel>;
  view: ReturnType<typeof useBellissimaEntityWorkspaceViewState>;
  shell: ReturnType<typeof useBellissimaWorkspaceShellState>;
};

let probe: Probe | null = null;

function buildEntityActionHandlers() {
  return {
    save: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
  };
}

function Harness() {
  const publish = useBellissimaEntityWorkspacePublisher();
  const model = useBellissimaWorkspaceModel();
  const view = useBellissimaEntityWorkspaceViewState();
  const shell = useBellissimaWorkspaceShellState();

  probe = { publish, model, view, shell };
  return null;
}

function buildDraftEntitySnapshot() {
  return buildContentBellissimaWorkspaceSnapshot({
    pageId: "page-1",
    title: "Forside",
    slug: "forside",
    documentTypeAlias: "contentPage",
    statusLabel: "draft",
    canvasMode: "edit",
    saveState: "saved",
    dirty: false,
    canSave: true,
    canPublish: true,
    canUnpublish: false,
    canPreview: true,
    canOpenPublic: false,
    activeWorkspaceView: "content",
  });
}

function buildPublishedEntitySnapshot() {
  return buildContentBellissimaWorkspaceSnapshot({
    pageId: "page-1",
    title: "Forside",
    slug: "forside",
    documentTypeAlias: "contentPage",
    statusLabel: "published",
    canvasMode: "edit",
    saveState: "saved",
    dirty: false,
    canSave: true,
    canPublish: true,
    canUnpublish: true,
    canPreview: true,
    canOpenPublic: true,
    activeWorkspaceView: "content",
  });
}

describe("workspace context single source", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actionHandlers: ReturnType<typeof buildEntityActionHandlers>;

  beforeEach(async () => {
    probe = null;
    actionHandlers = buildEntityActionHandlers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          ContentBellissimaWorkspaceProvider,
          null,
          createElement(Harness),
        ),
      );
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    probe = null;
  });

  it("keeps the active workspace view as the shared source for model tabs and footer state", async () => {
    await act(async () => {
      probe?.publish(buildDraftEntitySnapshot(), { actionHandlers });
    });

    expect(probe?.view.activeView).toBe("content");
    expect(probe?.model?.views.find((view) => view.active)?.id).toBe("content");
    expect(probe?.model?.primaryActions.map((action) => action.id)).toEqual([
      "save",
      "publish",
      "preview",
    ]);
    expect(probe?.model?.secondaryActions.map((action) => action.id)).toEqual([
      "history",
      "settings",
    ]);
    expect(probe?.model?.footerApps.find((app) => app.id === "view")?.value).toBe(
      contentWorkspaceViewLabel("content"),
    );

    await act(async () => {
      await probe?.model?.primaryActions.find((action) => action.id === "save")?.onSelect?.();
    });
    expect(actionHandlers.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      probe?.shell.setActiveSideApp("runtime");
    });
    expect(probe?.model?.footerApps.find((app) => app.id === "inspector")?.value).toBe(
      contentWorkspaceSideAppLabel("runtime"),
    );

    await act(async () => {
      probe?.view.setActiveView("preview");
    });

    expect(probe?.view.activeView).toBe("preview");
    expect(probe?.shell.activeSideApp).toBe("workspace");
    expect(probe?.model?.views.find((view) => view.active)?.id).toBe("preview");
    expect(probe?.model?.primaryActions.map((action) => action.id)).toEqual([
      "save",
      "publish",
      "public_page",
    ]);
    expect(probe?.model?.footerApps.find((app) => app.id === "view")?.value).toBe(
      contentWorkspaceViewLabel("preview"),
    );
    expect(probe?.model?.footerApps.find((app) => app.id === "inspector")?.value).toBe(
      contentInspectorSectionLabel(probe?.shell.activeInspectorSection ?? "content"),
    );

    await act(async () => {
      await probe?.model?.primaryActions.find((action) => action.id === "publish")?.onSelect?.();
    });
    expect(actionHandlers.publish).toHaveBeenCalledTimes(1);
  });

  it("routes inspector focus through the same shared workspace context", async () => {
    await act(async () => {
      probe?.publish(buildPublishedEntitySnapshot(), { actionHandlers });
    });

    await act(async () => {
      probe?.shell.setActiveSideApp("ai");
    });
    expect(probe?.shell.activeSideApp).toBe("ai");

    await act(async () => {
      probe?.shell.setActiveInspectorSection("governance");
    });

    expect(probe?.shell.activeInspectorSection).toBe("governance");
    expect(probe?.shell.activeSideApp).toBe("workspace");
    expect(probe?.model?.footerApps.find((app) => app.id === "inspector")?.value).toBe(
      contentInspectorSectionLabel("governance"),
    );
    expect(probe?.model?.inspectorSections.find((section) => section.active)?.id).toBe("governance");

    await act(async () => {
      await probe?.model?.secondaryActions.find((action) => action.id === "unpublish")?.onSelect?.();
    });
    expect(actionHandlers.unpublish).toHaveBeenCalledTimes(1);
  });
});
