import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const contentComponentsDir = path.join(
  process.cwd(),
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_components",
);
const contentWorkspaceDir = path.join(
  process.cwd(),
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_workspace",
);
const backofficeComponentsDir = path.join(process.cwd(), "components", "backoffice");

function readContentComponent(fileName: string) {
  return fs.readFileSync(path.join(contentComponentsDir, fileName), "utf8");
}

function readBackofficeComponent(fileName: string) {
  return fs.readFileSync(path.join(backofficeComponentsDir, fileName), "utf8");
}

describe("editor view consistency", () => {
  it("routes preview and editing through dedicated workspace surfaces in ContentWorkspace", () => {
    const source = readContentComponent("ContentWorkspace.tsx");

    expect(source).toContain('import { WorkspaceBody } from "./WorkspaceBody";');
    expect(source).toContain('import { WorkspacePreview } from "./WorkspacePreview";');
    expect(source).toContain('import { WorkspaceInspector } from "./WorkspaceInspector";');
    expect(source).toContain('shellModel.activeWorkspaceView === "preview"');
    expect(source).toContain("<WorkspacePreview");
    expect(source).toContain("<WorkspaceBody");
    expect(source).toContain("<WorkspaceInspector");
  });

  it("derives preview visibility from the active workspace view instead of a split-column toggle", () => {
    const source = readContentComponent("useContentWorkspaceUi.ts");

    expect(source).toContain("useBellissimaEntityWorkspaceViewState();");
    expect(source).toContain('const canvasMode: "edit" | "preview" = mainView === "preview" ? "preview" : "edit";');
    expect(source).toContain('setMainView(mode === "preview" ? "preview" : "content");');
    expect(source).toContain('const showPreview = showBlocks && canvasMode === "preview";');
  });

  it("keeps the editor mode strip passive so the workspace view remains canonical", () => {
    const source = readContentComponent("ContentWorkspaceEditorModeStrip.tsx");

    expect(source).not.toContain('aria-label="Rediger eller forhåndsvisning"');
    expect(source).not.toContain("setCanvasMode(");
    expect(source).toContain("Preview styres fra workspace-visningen");
  });

  it("keeps workspace header, body, preview, inspector, and footer ownership inside ContentWorkspace", () => {
    const shellSource = readContentComponent("ContentWorkspace.tsx");
    const hostSource = fs.readFileSync(
      path.join(contentWorkspaceDir, "ContentWorkspaceHost.tsx"),
      "utf8",
    );

    expect(shellSource).toContain('import { WorkspaceHeader } from "./WorkspaceHeader";');
    expect(shellSource).toContain('import { WorkspaceBody } from "./WorkspaceBody";');
    expect(shellSource).toContain('import { WorkspacePreview } from "./WorkspacePreview";');
    expect(shellSource).toContain('import { WorkspaceInspector } from "./WorkspaceInspector";');
    expect(shellSource).toContain('import { WorkspaceFooter } from "./WorkspaceFooter";');
    expect(shellSource).toContain("<WorkspaceHeader />");
    expect(shellSource).toContain("<WorkspaceBody");
    expect(shellSource).toContain("<WorkspacePreview");
    expect(shellSource).toContain("<WorkspaceInspector");
    expect(shellSource).toContain("<WorkspaceFooter />");
    expect(hostSource).not.toContain("WorkspaceHeader");
    expect(hostSource).not.toContain("WorkspaceBody");
    expect(hostSource).not.toContain("WorkspacePreview");
    expect(hostSource).not.toContain("WorkspaceInspector");
    expect(hostSource).not.toContain("WorkspaceFooter");
  });

  it("keeps header, footer, body, preview, inspector, and actions on the same canonical workspace view", () => {
    const shellSource = readContentComponent("ContentWorkspace.tsx");
    const routerSource = readContentComponent("WorkspaceViewRouter.tsx");
    const modelSource = readContentComponent("useContentWorkspaceShellModel.ts");
    const bellissimaSource = readContentComponent("useContentWorkspaceBellissima.ts");
    const headerSource = readBackofficeComponent("BellissimaWorkspaceHeader.tsx");
    const footerSource = readBackofficeComponent("BackofficeWorkspaceFooterApps.tsx");

    expect(shellSource).toContain('shellModel.activeWorkspaceView === "design"');
    expect(shellSource).toContain('shellModel.activeWorkspaceView === "global"');
    expect(shellSource).toContain('shellModel.activeWorkspaceView === "history"');
    expect(shellSource).toContain('shellModel.activeWorkspaceView === "preview"');
    expect(routerSource).toContain(
      'activeWorkspaceView === "content" || activeWorkspaceView === "preview"',
    );
    expect(modelSource).toContain("activeWorkspaceView: mainView");
    expect(bellissimaSource).toContain("activeWorkspaceView,");
    expect(bellissimaSource).toContain("buildContentBellissimaWorkspaceSnapshot({");
    expect(headerSource).toContain(
      "const model = useBellissimaWorkspaceModel();",
    );
    expect(headerSource).toContain("model.views");
    expect(headerSource).toContain(".map((view) => ({");
    expect(footerSource).toContain(
      "const model = useBellissimaWorkspaceModel();",
    );
    expect(footerSource).toContain(
      'const statusApps = model.footerApps.filter((app) => app.group === "status");',
    );
  });
});
