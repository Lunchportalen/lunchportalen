/**
 * U87: Property editor-komponent per blokk = samme kontrakt som kanonisk definisjon.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROPERTY_EDITOR_COMPONENT_BY_ALIAS, getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

const root = process.cwd();
const routerPath = path.join(
  root,
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_components",
  "blockPropertyEditors",
  "BlockPropertyEditorRouter.tsx",
);

describe("BlockEditorContractParity (U87)", () => {
  it("router JSX matcher propertyEditorComponent fra kanon for alle Block-typer", () => {
    const router = fs.readFileSync(routerPath, "utf8");
    const types: Block["type"][] = [
      "hero",
      "hero_full",
      "hero_bleed",
      "richText",
      "image",
      "cta",
      "divider",
      "banner",
      "form",
      "relatedLinks",
      "pricing",
      "cards",
      "zigzag",
      "grid",
    ];
    for (const t of types) {
      const comp = getBlockTypeDefinition(t)?.propertyEditorComponent;
      expect(comp, t).toBeTruthy();
      expect(PROPERTY_EDITOR_COMPONENT_BY_ALIAS[t]).toBe(comp);
      expect(router).toContain(`<${comp}`);
      expect(router).toContain(`case "${t}":`);
    }
  });
});
