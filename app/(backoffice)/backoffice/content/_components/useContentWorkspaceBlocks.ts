"use client";

import { useCallback, useMemo, useState } from "react";
import { serializeBodyEnvelope } from "./_stubs";
import type { Block, BlockType } from "./editorBlockTypes";
import {
  createBlock,
  deriveBodyForSave,
  type BodyMode,
  type BodyParseResult,
} from "./contentWorkspace.blocks";
import type { BlockType as AddModalBlockType } from "./_stubs";

export function useContentWorkspaceBlocks(options: {
  documentTypeAlias: string | null;
  envelopeFields: Record<string, unknown>;
}) {
  const { documentTypeAlias, envelopeFields } = options;

  const [bodyMode, setBodyMode] = useState<BodyMode>("blocks");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [legacyBodyText, setLegacyBodyText] = useState("");
  const [invalidBodyRaw, setInvalidBodyRaw] = useState("");
  const [bodyParseError, setBodyParseError] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  const bodyForSave = useMemo(() => {
    const blocksBody = deriveBodyForSave(
      bodyMode,
      blocks,
      meta,
      legacyBodyText,
      invalidBodyRaw
    );
    if (documentTypeAlias && documentTypeAlias.trim() !== "") {
      return serializeBodyEnvelope({
        documentType: documentTypeAlias,
        fields: envelopeFields,
        blocksBody,
      });
    }
    return blocksBody;
  }, [
    bodyMode,
    blocks,
    meta,
    legacyBodyText,
    invalidBodyRaw,
    documentTypeAlias,
    envelopeFields,
  ]);

  /** Replaces editor body with parsed result. Caller must pass normalized/valid result; AI apply paths use parseBodyToBlocks which normalizes. */
  const applyParsedBody = useCallback((parsed: BodyParseResult) => {
    setBodyMode(parsed.mode);
    setBlocks(parsed.blocks);
    setMeta(parsed.meta ?? {});
    setLegacyBodyText(parsed.legacyText);
    setInvalidBodyRaw(parsed.rawBody);
    setBodyParseError(parsed.error);
    setExpandedBlockId(
      parsed.mode === "blocks" ? parsed.blocks[0]?.id ?? null : null
    );
  }, []);

  const setBlockById = useCallback(
    (blockId: string, updater: (block: Block) => Block) => {
      setBlocks((prev) =>
        prev.map((entry) => (entry.id === blockId ? updater(entry) : entry))
      );
    },
    []
  );

  const onAddBlock = useCallback((type: AddModalBlockType) => {
    const next = createBlock(
      type as "hero" | "richText" | "image" | "cta" | "divider" | "banners" | "code"
    );
    setBodyMode("blocks");
    setBodyParseError(null);
    setLegacyBodyText("");
    setInvalidBodyRaw("");
    setBlocks((prev) => [...prev, next]);
    setExpandedBlockId(next.id);
  }, []);

  const onMoveBlock = useCallback((blockId: string, direction: -1 | 1) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((entry) => entry.id === blockId);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const current = next[idx];
      next[idx] = next[target];
      next[target] = current;
      return next;
    });
  }, []);

  const onDeleteBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((entry) => entry.id !== blockId));
    setExpandedBlockId((prev) => (prev === blockId ? null : prev));
  }, []);

  const onToggleBlock = useCallback((blockId: string) => {
    setExpandedBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  return {
    bodyMode,
    setBodyMode,
    blocks,
    setBlocks,
    meta,
    setMeta,
    legacyBodyText,
    setLegacyBodyText,
    invalidBodyRaw,
    setInvalidBodyRaw,
    bodyParseError,
    setBodyParseError,
    expandedBlockId,
    setExpandedBlockId,
    bodyForSave,
    applyParsedBody,
    setBlockById,
    onAddBlock,
    onMoveBlock,
    onDeleteBlock,
    onToggleBlock,
  };
}
