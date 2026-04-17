import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { createBackofficeBlockDraft, getBackofficeBlockCatalog } from "@/lib/cms/backofficeBlockCatalog";
import { resolveBlockLibraryEntries } from "@/app/(backoffice)/backoffice/content/_components/BlockLibrary";
import { createBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";

const contentComponentsDir = path.join(
  process.cwd(),
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_components",
);

function readContentComponent(fileName: string) {
  return fs.readFileSync(path.join(contentComponentsDir, fileName), "utf8");
}

describe("block flow single source", () => {
  it("filters block library entries from the canonical catalog without introducing a second registry", () => {
    const catalog = getBackofficeBlockCatalog();
    const allowlist = ["pricing", "hero", "cta"];

    expect(resolveBlockLibraryEntries({ allowedBlockTypeKeys: null })).toEqual(catalog);
    expect(resolveBlockLibraryEntries({ allowedBlockTypeKeys: [] })).toEqual([]);
    expect(resolveBlockLibraryEntries({ allowedBlockTypeKeys: allowlist })).toEqual(
      catalog.filter((definition) => allowlist.includes(definition.type)),
    );
  });

  it("creates new blocks from the same canonical draft defaults used by the library", () => {
    for (const blockType of ["hero", "pricing", "cta"] as const) {
      const created = createBlock(blockType);
      const canonical = createBackofficeBlockDraft(blockType);

      expect(created.type).toBe(blockType);
      expect(canonical).toBeTruthy();
      expect(created).toMatchObject({
        ...canonical,
        id: expect.any(String),
      });
    }
  });

  it("builds block instances from the canonical catalog helpers without reviving a second registry", () => {
    const source = readContentComponent("contentWorkspace.blocks.ts");

    expect(source).toContain(
      'import { createBackofficeBlockDraft, isBackofficeBlockType } from "@/lib/cms/backofficeBlockCatalog";',
    );
    expect(source).not.toContain("blockRegistry");
  });

  it("funnels legacy add and picker entrypoints through BlockLibrary", () => {
    const addModalSource = readContentComponent("BlockAddModal.tsx");
    const pickerSource = readContentComponent("BlockPickerOverlay.tsx");

    expect(addModalSource).toContain('import { BlockLibrary } from "./BlockLibrary";');
    expect(addModalSource).toContain("<BlockLibrary");
    expect(pickerSource).toContain('import { BlockLibrary, type BlockLibraryProps } from "./BlockLibrary";');
    expect(pickerSource).toContain("return <BlockLibrary {...props} />;");
  });

  it("uses BlockLibrary directly in the workspace modal stack", () => {
    const modalStackSource = readContentComponent("ContentWorkspaceModalStack.tsx");

    expect(modalStackSource).toContain('import { BlockLibrary } from "./BlockLibrary";');
    expect(modalStackSource).toContain("<BlockLibrary");
    expect(modalStackSource).not.toContain('import { BlockPickerOverlay }');
  });

  it("keeps legacy block entrypoints out of the composition shell", () => {
    const workspaceSource = readContentComponent("ContentWorkspace.tsx");

    expect(workspaceSource).not.toContain("BlockAddModal");
    expect(workspaceSource).not.toContain("BlockPickerOverlay");
    expect(workspaceSource).not.toContain("BlockLibrary");
  });
});
