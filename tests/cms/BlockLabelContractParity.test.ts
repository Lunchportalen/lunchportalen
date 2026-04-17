import { describe, expect, test } from "vitest";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import { getBlockTreeLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";
import {
  buildBlockEntryPreviewSummary,
  buildBlockEntryTreeLabel,
  getBlockEntryFlatForRender,
  KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS,
} from "@/lib/cms/blocks/blockEntryContract";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";

describe("BlockLabelContractParity (U91)", () => {
  test("navigator/tree label er lik kanonisk buildBlockEntryTreeLabel for entry-blokker", () => {
    for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
      const def = getBlockTypeDefinition(alias);
      const raw = { id: `id-${alias}`, type: alias, ...def!.defaultsFactory() };
      const block = normalizeBlock(raw);
      expect(block).toBeTruthy();
      expect(getBlockTreeLabel(block!)).toBe(buildBlockEntryTreeLabel(block!));
    }
  });

  test("preview summary = definitions.previewSummaryBuilder(flat) for samme blokk", () => {
    for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
      const def = getBlockTypeDefinition(alias);
      const raw = { id: `id-${alias}`, type: alias, ...def!.defaultsFactory() };
      const block = normalizeBlock(raw);
      expect(block).toBeTruthy();
      const flat = getBlockEntryFlatForRender(block!);
      expect(buildBlockEntryPreviewSummary(block!)).toBe(def!.previewSummaryBuilder(flat));
    }
  });
});
