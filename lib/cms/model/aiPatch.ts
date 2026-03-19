/**
 * Phase 27: AI patch format and validation (fail-closed).
 * Single source for AIPatchV1; import BlockList/BlockNode from canonical blockTypes.
 */

import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";

export type AIPatchV1 = {
  version: 1;
  ops: Array<
    | { op: "updateBlockData"; id: string; data: Record<string, unknown> }
    | { op: "insertBlock"; index: number; block: Partial<BlockNode> & Pick<BlockNode, "type"> }
    | { op: "removeBlock"; id: string }
    | { op: "moveBlock"; id: string; toIndex: number }
  >;
};

export function isAIPatchV1(value: unknown): value is AIPatchV1 {
  if (value == null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!Array.isArray(o.ops)) return false;
  const ops = o.ops as unknown[];
  if (ops.length < 1 || ops.length > 20) return false;
  const allowed = ["updateBlockData", "insertBlock", "removeBlock", "moveBlock"];
  for (const op of ops) {
    if (op == null || typeof op !== "object") return false;
    const opObj = op as Record<string, unknown>;
    const opKind = opObj.op;
    if (typeof opKind !== "string" || !allowed.includes(opKind)) return false;
    if (opKind === "updateBlockData") {
      if (typeof opObj.id !== "string") return false;
      const data = opObj.data;
      if (data != null && (typeof data !== "object" || Array.isArray(data))) return false;
      if (data != null && typeof data === "object" && !Array.isArray(data)) {
        if ("id" in data || "type" in data) return false;
      }
    }
    if (opKind === "insertBlock") {
      if (typeof opObj.index !== "number" || !Number.isInteger(opObj.index) || opObj.index < 0) return false;
      const block = opObj.block;
      if (block == null || typeof block !== "object" || Array.isArray(block)) return false;
      const b = block as Record<string, unknown>;
      if (typeof b.type !== "string" || String(b.type).trim() === "") return false;
      if (b.data != null && (typeof b.data !== "object" || Array.isArray(b.data))) return false;
    }
    if (opKind === "removeBlock" || opKind === "moveBlock") {
      if (typeof opObj.id !== "string") return false;
    }
    if (opKind === "moveBlock") {
      if (typeof opObj.toIndex !== "number" || !Number.isInteger(opObj.toIndex) || opObj.toIndex < 0) return false;
    }
  }
  return true;
}

/** Validates patch against current body; ensures all target block ids and indices exist before apply. */
export function validateAIPatchV1(
  patch: AIPatchV1,
  body: BlockList
): { ok: true } | { ok: false; reason: string } {
  if (body.version !== 1) return { ok: false, reason: "Body version is not 1" };
  const blocks = body.blocks ?? [];
  const ids = new Set(blocks.map((b) => b.id));

  for (let i = 0; i < patch.ops.length; i++) {
    const op = patch.ops[i];
    if (op.op === "updateBlockData") {
      if (!ids.has(op.id)) return { ok: false, reason: "updateBlockData: block id not found" };
      const data = op.data;
      if (data != null && typeof data === "object" && !Array.isArray(data)) {
        if ("id" in data || "type" in data) return { ok: false, reason: "updateBlockData: data must not contain id or type" };
      }
    }
    if (op.op === "insertBlock") {
      const idx = op.index;
      if (idx < 0 || idx > blocks.length) return { ok: false, reason: "insertBlock: index out of range" };
      const block = op.block;
      if (typeof block.type !== "string" || String(block.type).trim() === "") return { ok: false, reason: "insertBlock: block.type must be non-empty string" };
      if (block.data != null && (typeof block.data !== "object" || Array.isArray(block.data))) return { ok: false, reason: "insertBlock: block.data must be object if present" };
    }
    if (op.op === "removeBlock") {
      if (!ids.has(op.id)) return { ok: false, reason: "removeBlock: block id not found" };
    }
    if (op.op === "moveBlock") {
      if (!ids.has(op.id)) return { ok: false, reason: "moveBlock: block id not found" };
      const toIndex = op.toIndex;
      if (toIndex < 0 || toIndex >= blocks.length) return { ok: false, reason: "moveBlock: toIndex out of range" };
    }
  }
  return { ok: true };
}