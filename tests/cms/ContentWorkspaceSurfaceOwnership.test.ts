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

function readContentComponent(fileName: string) {
  return fs.readFileSync(path.join(contentComponentsDir, fileName), "utf8");
}

function readContentWorkspaceFile(fileName: string) {
  return fs.readFileSync(path.join(contentWorkspaceDir, fileName), "utf8");
}

describe("ContentWorkspace surface ownership", () => {
  it("keeps direct workspace surface ownership inside ContentWorkspace while host stays surface-free", () => {
    const workspaceSource = readContentComponent("ContentWorkspace.tsx");
    const hostSource = readContentWorkspaceFile("ContentWorkspaceHost.tsx");

    expect(workspaceSource).toContain("<WorkspaceHeader />");
    expect(workspaceSource).toContain("<WorkspaceBody");
    expect(workspaceSource).toContain("<WorkspacePreview");
    expect(workspaceSource).toContain("<WorkspaceInspector");
    expect(workspaceSource).toContain("<WorkspaceFooter />");
    expect(workspaceSource).toContain("<ContentWorkspaceWorkspaceFrame");
    expect(workspaceSource).not.toContain("WorkspaceViewRouter");

    expect(hostSource).not.toContain("WorkspaceHeader");
    expect(hostSource).not.toContain("WorkspaceBody");
    expect(hostSource).not.toContain("WorkspacePreview");
    expect(hostSource).not.toContain("WorkspaceInspector");
    expect(hostSource).not.toContain("WorkspaceFooter");
    expect(hostSource).not.toContain("ContentWorkspaceWorkspaceFrame");
    expect(hostSource).not.toContain("WorkspaceViewRouter");
    expect(hostSource).not.toContain("ContentWorkspacePageEditorShell");
    expect(hostSource).not.toContain("ContentWorkspaceChrome");
  });

  it("keeps router and page shell surface-free", () => {
    const routerSource = readContentComponent("WorkspaceViewRouter.tsx");
    const pageShellSource = readContentComponent("ContentWorkspacePageEditorShell.tsx");

    expect(routerSource).not.toContain("WorkspaceHeader");
    expect(routerSource).not.toContain("WorkspaceBody");
    expect(routerSource).not.toContain("WorkspacePreview");
    expect(routerSource).not.toContain("WorkspaceInspector");
    expect(routerSource).not.toContain("WorkspaceFooter");
    expect(routerSource).not.toContain("ContentWorkspacePageEditorShell");

    expect(pageShellSource).not.toContain("WorkspaceHeader");
    expect(pageShellSource).not.toContain("WorkspaceBody");
    expect(pageShellSource).not.toContain("WorkspacePreview");
    expect(pageShellSource).not.toContain("WorkspaceInspector");
    expect(pageShellSource).not.toContain("WorkspaceFooter");
    expect(pageShellSource).not.toContain("ContentWorkspaceEditorMountRouter");
  });

  it("keeps activeWorkspaceView as the only canonical view handoff", () => {
    const workspaceSource = readContentComponent("ContentWorkspace.tsx");
    const routerSource = readContentComponent("WorkspaceViewRouter.tsx");
    const modelSource = readContentComponent("useContentWorkspaceShellModel.ts");
    const uiSource = readContentComponent("useContentWorkspaceUi.ts");
    const bellissimaSource = readContentComponent("useContentWorkspaceBellissima.ts");

    expect(modelSource).toContain("activeWorkspaceView: mainView");
    expect(workspaceSource).toContain('shellModel.activeWorkspaceView === "design"');
    expect(workspaceSource).toContain('shellModel.activeWorkspaceView === "global"');
    expect(workspaceSource).toContain('shellModel.activeWorkspaceView === "history"');
    expect(workspaceSource).toContain('shellModel.activeWorkspaceView === "preview"');
    expect(routerSource).toContain('activeWorkspaceView === "content" || activeWorkspaceView === "preview"');
    expect(uiSource).toContain(
      'const canvasMode: "edit" | "preview" = mainView === "preview" ? "preview" : "edit";',
    );
    expect(bellissimaSource).toContain("activeWorkspaceView,");
  });
});
