"use client";

// STATUS: KEEP

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
  invariantEnvelopeFields: Record<string, unknown>;
  cultureEnvelopeFields: Record<string, unknown>;
  /** Optional: e.g. close modal + animation after add (shell wiring). */
  onAfterAddBlock?: (block: Block) => void;
}) {
  const { documentTypeAlias, invariantEnvelopeFields, cultureEnvelopeFields, onAfterAddBlock } = options;

  const [bodyMode, setBodyMode] = useState<BodyMode>("blocks");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [legacyBodyText, setLegacyBodyText] = useState("");
  const [invalidBodyRaw, setInvalidBodyRaw] = useState("");
  const [bodyParseError, setBodyParseError] = useState<string | null>(null);

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
        invariantFields: invariantEnvelopeFields,
        cultureFields: cultureEnvelopeFields,
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
    invariantEnvelopeFields,
    cultureEnvelopeFields,
  ]);

  /** Replaces editor body with parsed result. Caller must pass normalized/valid result; AI apply paths use parseBodyToBlocks which normalizes. */
  const applyParsedBody = useCallback((parsed: BodyParseResult) => {
    setBodyMode(parsed.mode);
    setBlocks(parsed.blocks);
    setMeta(parsed.meta ?? {});
    setLegacyBodyText(parsed.legacyText);
    setInvalidBodyRaw(parsed.rawBody);
    setBodyParseError(parsed.error);
  }, []);

  const setBlockById = useCallback((blockId: string, updater: (block: Block) => Block) => {
    if (!blockId || typeof blockId !== "string") return;
    setBlocks((prev) => {
      if (!prev.find((b) => b.id === blockId)) return prev;
      return prev.map((entry) => (entry.id === blockId ? updater(entry) : entry));
    });
  }, []);

  const onAddBlock = useCallback(
    (type: AddModalBlockType) => {
      const next = createBlock(type as BlockType);
      setBodyMode("blocks");
      setBodyParseError(null);
      setLegacyBodyText("");
      setInvalidBodyRaw("");
      setBlocks((prev) => [...prev, next]);
      onAfterAddBlock?.(next);
    },
    [documentTypeAlias, onAfterAddBlock]
  );

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
    bodyForSave,
    applyParsedBody,
    setBlockById,
    onAddBlock,
    onMoveBlock,
    onDeleteBlock,
  };
}
