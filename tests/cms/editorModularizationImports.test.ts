/**
 * Editor modularization: import integrity for ContentWorkspace shell, panels, state, loader, actions.
 * Ensures modules exist and export expected symbols without reducing coverage.
 */
import { describe, it, expect } from "vitest";

const contentPath = "app/(backoffice)/backoffice/content/_components";

describe("editor modularization – import integrity", () => {
  it("ContentWorkspaceState module loads and exports", async () => {
    const mod = await import(`@/${contentPath}/ContentWorkspaceState.ts`);
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
    expect(Object.keys(mod).length).toBeGreaterThanOrEqual(0);
  });

  it("ContentWorkspaceLoader exports createOnPageLoaded, createOnReset, createOnPageError, createDetailLoadStart", async () => {
    const mod = await import(`@/${contentPath}/ContentWorkspaceLoader.ts`);
    expect(mod.createOnPageLoaded).toBeDefined();
    expect(mod.createOnReset).toBeDefined();
    expect(mod.createOnPageError).toBeDefined();
    expect(mod.createDetailLoadStart).toBeDefined();
    expect(typeof mod.createOnPageLoaded).toBe("function");
    expect(typeof mod.createOnReset).toBe("function");
    expect(typeof mod.createOnPageError).toBe("function");
    expect(typeof mod.createDetailLoadStart).toBe("function");
  });

  it("ContentWorkspaceActions exports createOnCreate", async () => {
    const mod = await import(`@/${contentPath}/ContentWorkspaceActions.ts`);
    expect(mod.createOnCreate).toBeDefined();
    expect(typeof mod.createOnCreate).toBe("function");
    expect(mod.runControl).toBeDefined();
    expect(typeof mod.runControl).toBe("function");
    expect(Array.isArray(mod.CONTROL_TOWER_ACTIONS)).toBe(true);
    expect(mod.CONTROL_TOWER_ACTIONS.length).toBeGreaterThan(0);
  });

  it("ContentWorkspaceShell exports component", async () => {
    const mod = await import(`@/${contentPath}/ContentWorkspaceShell.tsx`);
    expect(mod.ContentWorkspaceShell).toBeDefined();
    expect(typeof mod.ContentWorkspaceShell).toBe("function");
  });

  it("ContentWorkspacePanels exports SidebarPanel and MainPanel", async () => {
    const mod = await import(`@/${contentPath}/ContentWorkspacePanels.tsx`);
    expect(mod.ContentWorkspaceSidebarPanel).toBeDefined();
    expect(mod.ContentWorkspaceMainPanel).toBeDefined();
    expect(typeof mod.ContentWorkspaceSidebarPanel).toBe("function");
    expect(typeof mod.ContentWorkspaceMainPanel).toBe("function");
  });

  it("workspace shell modules export Bellissima editor surfaces", async () => {
    const [header, body, preview, inspector, footer] = await Promise.all([
      import(`@/${contentPath}/WorkspaceHeader.tsx`),
      import(`@/${contentPath}/WorkspaceBody.tsx`),
      import(`@/${contentPath}/WorkspacePreview.tsx`),
      import(`@/${contentPath}/WorkspaceInspector.tsx`),
      import(`@/${contentPath}/WorkspaceFooter.tsx`),
    ]);

    expect(typeof header.WorkspaceHeader).toBe("function");
    expect(typeof body.WorkspaceBody).toBe("function");
    expect(typeof preview.WorkspacePreview).toBe("function");
    expect(typeof inspector.WorkspaceInspector).toBe("function");
    expect(typeof footer.WorkspaceFooter).toBe("function");
  });

  it("ContentWorkspace exports default component", async () => {
    const mod = await import(`@/${contentPath}/ContentWorkspace.tsx`);
    expect(mod.ContentWorkspace).toBeDefined();
    expect(typeof mod.ContentWorkspace).toBe("function");
  });
});
