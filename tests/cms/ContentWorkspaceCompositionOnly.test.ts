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

describe("ContentWorkspace composition only", () => {
  it("keeps ContentWorkspace as the canonical composition shell", () => {
    const source = readContentComponent("ContentWorkspace.tsx");
    const hostSource = readContentWorkspaceFile("ContentWorkspaceHost.tsx");

    expect(source).toContain('import { WorkspaceHeader } from "./WorkspaceHeader";');
    expect(source).toContain('import { WorkspaceBody } from "./WorkspaceBody";');
    expect(source).toContain('import { WorkspacePreview } from "./WorkspacePreview";');
    expect(source).toContain('import { WorkspaceInspector } from "./WorkspaceInspector";');
    expect(source).toContain('import { WorkspaceFooter } from "./WorkspaceFooter";');
    expect(source).toContain("const shellModel = useContentWorkspaceShellModel(props);");
    expect(source).toContain("<WorkspaceHeader />");
    expect(source).toContain("<WorkspaceBody");
    expect(source).toContain("<WorkspacePreview");
    expect(source).toContain("<WorkspaceInspector");
    expect(source).toContain("<WorkspaceFooter />");
    expect(source).toContain(
      "legacySidebar={<ContentWorkspaceLegacySidebar {...shellModel.legacySidebarProps} />}",
    );
    expect(source).toContain(
      'shellModel.activeWorkspaceView === "preview"',
    );
    expect(source).toContain(
      "<ContentWorkspaceModalShell {...shellModel.modalShellProps} />",
    );
    expect(source).toContain("<ContentWorkspaceShellGlobalStyles />");
    expect(source).not.toContain("ContentWorkspaceFinalComposition");
    expect(source).not.toContain("WorkspaceViewRouter");

    expect(hostSource).not.toContain("WorkspaceHeader");
    expect(hostSource).not.toContain("WorkspaceBody");
    expect(hostSource).not.toContain("WorkspacePreview");
    expect(hostSource).not.toContain("WorkspaceInspector");
    expect(hostSource).not.toContain("WorkspaceFooter");
    expect(hostSource).not.toContain("WorkspaceViewRouter");
    expect(hostSource).not.toContain("ContentWorkspaceWorkspaceFrame");
    expect(hostSource).not.toContain("ContentWorkspacePageEditorShell");
  });

  it("does not reintroduce controller logic, local action derivation, or legacy block ownership", () => {
    const source = readContentComponent("ContentWorkspace.tsx");

    expect(source).toContain("ContentDetailSecondaryInspector");
    expect(source).not.toContain("useCallback");
    expect(source).not.toContain("BlockAddModal");
    expect(source).not.toContain("BlockPickerOverlay");
    expect(source).not.toContain("BlockLibrary");
    expect(source).not.toContain("buildContentWorkspacePageEditorShellBundle");
    expect(source).not.toContain("buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields");
    expect(source).not.toContain("useContentWorkspaceBellissima");
    expect(source).not.toContain("actionHandlers");
    expect(source).not.toContain("primaryAction");
    expect(source).not.toContain("secondaryAction");
  });
});
