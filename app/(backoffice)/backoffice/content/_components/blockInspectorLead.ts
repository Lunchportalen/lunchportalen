import type { Block } from "./editorBlockTypes";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";

/** Én linje øverst i inspektoren — tydeliggjør redaksjonell jobb per blokktype (kanonisk whenToUse). */
export function getBlockInspectorLead(block: Block): string {
  return getBlockTypeDefinition(block.type)?.whenToUse ?? "Rediger innhold for denne blokken.";
}
