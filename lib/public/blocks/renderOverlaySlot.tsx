import type { ReactNode } from "react";
import type { BlockNode } from "@/lib/cms/model/blockTypes";
import type { OverlaySlotId } from "@/lib/cms/overlays/slots";
import { isOverlaySlotId, isAllowedOverlayBlockType } from "@/lib/cms/overlays/slots";
import { renderBlock } from "@/lib/public/blocks/renderBlock";

type Env = "prod" | "staging";
type Locale = "nb" | "en";

export function renderOverlaySlot(
  blocks: BlockNode[],
  slotId: OverlaySlotId,
  env: Env = "prod",
  locale: Locale = "nb"
): ReactNode {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const filtered = blocks.filter((block) => {
    const slot = block.data?.slot;
    const assignSlot = isOverlaySlotId(slot) ? slot : "header";
    return assignSlot === slotId && isAllowedOverlayBlockType(block.type);
  });
  if (filtered.length === 0) return null;
  return (
    <>
      {filtered.map((block) => (
        <div key={block.id} className="mb-3">
          {renderBlock(block, env, locale)}
        </div>
      ))}
    </>
  );
}
