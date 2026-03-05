/**
 * Phase 27: Apply AIPatchV1 to BlockList (immutable, deterministic).
 * Import from canonical blockTypes and blockId.
 */

import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";
import { validateAIPatchV1 } from "@/lib/cms/model/aiPatch";

export function applyAIPatchV1(
  body: BlockList,
  patch: AIPatchV1
): { ok: true; next: BlockList; affectedIds: string[] } | { ok: false; reason: string } {
  if (body.version !== 1) return { ok: false, reason: "Body version is not 1" };
  const validation = validateAIPatchV1(patch, body);
  if (!validation.ok) return { ok: false, reason: (validation as { ok: false; reason: string }).reason };

  let blocks = [...(body.blocks ?? [])];
  const affectedIds: string[] = [];

  for (const op of patch.ops) {
    if (op.op === "updateBlockData") {
      const idx = blocks.findIndex((b) => b.id === op.id);
      if (idx === -1) return { ok: false, reason: "updateBlockData: block not found" };
      const block = blocks[idx];
      const nextData = { ...(block.data ?? {}), ...op.data };
      blocks = blocks.slice(0, idx).concat([{ ...block, data: nextData }]).concat(blocks.slice(idx + 1));
      if (!affectedIds.includes(op.id)) affectedIds.push(op.id);
    }
    if (op.op === "insertBlock") {
      const id = (op.block.id && String(op.block.id).trim()) ? op.block.id : newBlockId();
      const node: BlockNode = { id, type: op.block.type, data: op.block.data ?? {} };
      const index = Math.min(Math.max(0, op.index), blocks.length);
      blocks = blocks.slice(0, index).concat([node]).concat(blocks.slice(index));
      affectedIds.push(id);
    }
    if (op.op === "removeBlock") {
      const idx = blocks.findIndex((b) => b.id === op.id);
      if (idx === -1) return { ok: false, reason: "removeBlock: block not found" };
      blocks = blocks.slice(0, idx).concat(blocks.slice(idx + 1));
      affectedIds.push(op.id);
    }
    if (op.op === "moveBlock") {
      const idx = blocks.findIndex((b) => b.id === op.id);
      if (idx === -1) return { ok: false, reason: "moveBlock: block not found" };
      const block = blocks[idx];
      blocks = blocks.slice(0, idx).concat(blocks.slice(idx + 1));
      const toIndex = Math.min(Math.max(0, op.toIndex), blocks.length);
      blocks = blocks.slice(0, toIndex).concat([block]).concat(blocks.slice(toIndex));
      affectedIds.push(op.id);
    }
  }

  const next: BlockList = { version: 1, blocks, meta: body.meta };
  return { ok: true, next, affectedIds };
}