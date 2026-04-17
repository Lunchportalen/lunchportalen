import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getBlockFormLayout } from "@/app/(backoffice)/backoffice/content/_components/blockFieldSchemas";

/** U76: workspace + inspector følger egenskapseditor-modellen med tydelig innhold/presentasjon. */
describe("WorkspacePropertyEditorParity (U76)", () => {
  const root = process.cwd();
  const fieldsPath = path.join(
    root,
    "app",
    "(backoffice)",
    "backoffice",
    "content",
    "_components",
    "BlockInspectorFields.tsx",
  );
  const workspacePath = path.join(
    root,
    "app",
    "(backoffice)",
    "backoffice",
    "content",
    "_components",
    "WorkspaceBody.tsx",
  );
  const inspectorCardPath = path.join(
    root,
    "app",
    "(backoffice)",
    "backoffice",
    "content",
    "_components",
    "ContentWorkspacePropertiesInspectorCard.tsx",
  );

  it("BlockInspectorFields bruker BlockPropertyEditorRouter; nøkkel-editorer dekker content/settings/structure", () => {
    const src = fs.readFileSync(fieldsPath, "utf8");
    expect(src).toContain("BlockPropertyEditorRouter");
    expect(src).toContain("data-lp-property-editor-surface");
    const peDir = path.join(
      root,
      "app",
      "(backoffice)",
      "backoffice",
      "content",
      "_components",
      "blockPropertyEditors",
    );
    const peFiles = fs.readdirSync(peDir).filter((f) => f.endsWith(".tsx"));
    const combined = peFiles.map((f) => fs.readFileSync(path.join(peDir, f), "utf8")).join("\n");
    expect(combined).toContain('PropertyEditorSection section="content"');
    expect(combined).toContain('PropertyEditorSection section="settings"');
    expect(combined).toContain('PropertyEditorSection section="structure"');
  });

  it("WorkspaceBody beskriver canvas vs egenskapseditor eksplisitt", () => {
    const src = fs.readFileSync(workspacePath, "utf8");
    expect(src).toContain("UmbracoBlockPropertyField");
    expect(src).toContain("renderInlineEditor");
  });

  it("Properties inspector-kort merket som egenskapseditor", () => {
    const src = fs.readFileSync(inspectorCardPath, "utf8");
    expect(src).toContain("data-lp-inspector-property-editor-banner");
    expect(src).toContain("Egenskapseditor");
  });

  it("Schema: nøkkelblokker har content skilt fra settings i layout-metadata", () => {
    const pricing = getBlockFormLayout("pricing");
    expect(pricing?.groups?.some((g) => g.section === "content")).toBe(true);
    expect(pricing?.groups?.some((g) => g.section === "structure")).toBe(true);

    const cards = getBlockFormLayout("cards");
    expect(cards?.groups?.some((g) => g.section === "content")).toBe(true);
    expect(cards?.groups?.some((g) => g.section === "structure")).toBe(true);

    const hero = getBlockFormLayout("hero");
    expect(hero?.groups?.some((g) => g.section === "content")).toBe(true);
    expect(hero?.groups?.some((g) => g.section === "settings")).toBe(true);
  });

  it("U80: detail-route embedder egenskapseditor inline under rad når ikke pageBuilder-variant", () => {
    const src = fs.readFileSync(workspacePath, "utf8");
    expect(src).toContain("BlockInspectorFields");
    expect(src).toContain("data-lp-detail-selected-module-canvas");
  });
});
