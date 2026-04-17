import { describe, expect, test } from "vitest";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import {
  expandRawBlockRowToFlatRenderFields,
  getBlockEntryFlatForRender,
  KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS,
} from "@/lib/cms/blocks/blockEntryContract";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";

/** U91: canvas/property editor deler samme flat projeksjon som normalize → Block. */
describe("BlockCustomViewModelParity (U91)", () => {
  test("getBlockEntryFlatForRender matcher expandRawBlockRowToFlatRenderFields for normaliserte blokker", () => {
    for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
      const def = getBlockTypeDefinition(alias);
      const raw = { id: `id-${alias}`, type: alias, ...def!.defaultsFactory() };
      const block = normalizeBlock(raw);
      expect(block).toBeTruthy();
      const a = getBlockEntryFlatForRender(block!);
      const b = expandRawBlockRowToFlatRenderFields(block as unknown as Record<string, unknown>);
      expect(a).toEqual(b);
    }
  });
});
