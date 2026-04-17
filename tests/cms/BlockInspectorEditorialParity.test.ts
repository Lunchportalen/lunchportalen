import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getBlockInspectorLead } from "@/app/(backoffice)/backoffice/content/_components/blockInspectorLead";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

describe("BlockInspectorEditorialParity (U75)", () => {
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
  const src = fs.readFileSync(fieldsPath, "utf8");
  const peDir = path.join(
    root,
    "app",
    "(backoffice)",
    "backoffice",
    "content",
    "_components",
    "blockPropertyEditors",
  );
  const peCombined = fs
    .readdirSync(peDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => fs.readFileSync(path.join(peDir, f), "utf8"))
    .join("\n");

  it("inspektoren har stabile hook og type-spesifikke røtter (ikke bare generisk feltstakk)", () => {
    expect(src).toContain("data-lp-inspector");
    expect(src).toContain("data-lp-block-type={block.type}");
    expect(src).toContain("data-lp-property-editor-surface");
    const identityPath = path.join(
      root,
      "app",
      "(backoffice)",
      "backoffice",
      "content",
      "_components",
      "BlockInspectorFieldsIdentity.tsx",
    );
    expect(fs.readFileSync(identityPath, "utf8")).toContain("data-lp-inspector-lead");
    expect(peCombined).toContain("data-lp-inspector-pricing-root");
    expect(peCombined).toContain("data-lp-inspector-cards-root");
    expect(peCombined).toContain("data-lp-inspector-zigzag-root");
    expect(peCombined).toContain("data-lp-inspector-related-root");
    expect(peCombined).toContain("data-lp-inspector-grid-root");
    expect(peCombined).toContain("data-lp-inspector-cta-root");
    expect(peCombined).toContain('PropertyEditorSection section="content"');
    expect(peCombined).toContain('PropertyEditorSection section="settings"');
    expect(peCombined).toContain('PropertyEditorSection section="structure"');
    expect(peCombined).toContain("Prisblokk · overskrift og intro");
    expect(peCombined).toContain("Kortseksjon · overskrift og ingress");
    expect(peCombined).toContain("Innhold · budskap, media og handling");
  });

  it("blokkspesifikke lead-linjer er meningsfulle og ulike for nøkkeltyper", () => {
    const types: Block["type"][] = [
      "hero",
      "cards",
      "zigzag",
      "pricing",
      "cta",
      "relatedLinks",
    ];
    const leads = types.map((t) => getBlockInspectorLead({ id: "x", type: t } as Block));
    expect(new Set(leads).size).toBe(types.length);
    expect(leads.some((l) => l.toLowerCase().includes("pris"))).toBe(true);
    expect(leads.some((l) => l.toLowerCase().includes("relaterte"))).toBe(true);
  });
});
