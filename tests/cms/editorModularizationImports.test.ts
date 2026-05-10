/**
 * Editor modularization: import integrity for ContentWorkspace shell, panels, state, loader, actions.
 * Ensures modules exist and export expected symbols without reducing coverage.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const contentDir = path.join(process.cwd(), "app/(backoffice)/backoffice/content/_components");
const sourceCache = new Map<string, string>();

function readComponent(relativePath: string) {
  const cached = sourceCache.get(relativePath);
  if (cached != null) return cached;
  const fullPath = path.join(contentDir, relativePath);
  expect(existsSync(fullPath), `${relativePath} should exist`).toBe(true);
  const source = readFileSync(fullPath, "utf8");
  sourceCache.set(relativePath, source);
  return source;
}

function expectNamedExport(source: string, exportName: string) {
  expect(
    new RegExp(`export\\s+(?:async\\s+function|function|const|class|type|interface)\\s+${exportName}\\b`).test(source) ||
      new RegExp(`export\\s*\\{[^}]*\\b${exportName}\\b`).test(source),
    `expected named export ${exportName}`,
  ).toBe(true);
}

describe("editor modularization – import integrity", () => {
  it("core workspace modules expose expected contracts", () => {
    const expectations = [
      ["ContentWorkspaceState.ts", ["PageLoadedData", "ContentPage"]],
      ["ContentWorkspaceLoader.ts", ["createOnPageLoaded", "createOnReset", "createOnPageError", "createDetailLoadStart"]],
      ["ContentWorkspaceActions.ts", ["createOnCreate", "runControl", "CONTROL_TOWER_ACTIONS"]],
      ["ContentWorkspaceShell.tsx", ["ContentWorkspaceShell"]],
      ["ContentWorkspacePanels.tsx", ["ContentWorkspaceSidebarPanel", "ContentWorkspaceMainPanel"]],
    ] as const;

    for (const [file, exports] of expectations) {
      const source = readComponent(file);
      for (const exportName of exports) {
        expectNamedExport(source, exportName);
      }
    }
  });

  it("workspace shell modules export Bellissima editor surfaces", () => {
    const modules = [
      ["WorkspaceHeader.tsx", "WorkspaceHeader"],
      ["WorkspaceBody.tsx", "WorkspaceBody"],
      ["WorkspacePreview.tsx", "WorkspacePreview"],
      ["WorkspaceInspector.tsx", "WorkspaceInspector"],
      ["WorkspaceFooter.tsx", "WorkspaceFooter"],
    ] as const;
    for (const [file, exportName] of modules) {
      expectNamedExport(readComponent(file), exportName);
    }
  });

  it("ContentWorkspace exports component entrypoint", () => {
    expectNamedExport(readComponent("ContentWorkspace.tsx"), "ContentWorkspace");
  });
});
