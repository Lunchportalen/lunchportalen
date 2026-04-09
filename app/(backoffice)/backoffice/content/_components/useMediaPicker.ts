"use client";

import { useCallback, useEffect, useState } from "react";
import { isValidMediaItemId } from "@/lib/media/ids";

export type MediaPickerTarget = {
  blockId: string;
  itemId?: string;
  field: "imageUrl" | "videoUrl" | "heroImageUrl";
};

export type MediaSelectionItem = { url: string; alt?: string; caption?: string; id?: string } | string;

function asMediaItemId(id: string | undefined): string | undefined {
  return isValidMediaItemId(id) ? (id as string).trim() : undefined;
}

/** True if item has a non-empty url (required for storing a valid media reference). */
export function hasValidSelectionUrl(item: MediaSelectionItem): boolean {
  const url = typeof item === "string" ? item : item?.url;
  return typeof url === "string" && url.trim().length > 0;
}

export function applyMediaSelectionToBlock<BlockShape = any>(
  block: BlockShape,
  target: MediaPickerTarget,
  item: MediaSelectionItem
): BlockShape {
  if (!hasValidSelectionUrl(item)) return block;
  const url = (typeof item === "string" ? item : item.url).trim();
  const alt = typeof item === "string" ? undefined : item.alt;
  const caption = typeof item === "string" ? undefined : (item as { caption?: string }).caption;
  const rawId = typeof item === "string" ? undefined : (item as { id?: string }).id;
  const mediaItemId = asMediaItemId(rawId);

  const c: any = block;

  if (target.field === "heroImageUrl") {
    if (c.type !== "hero" && c.type !== "hero_full") return block;
    return {
      ...c,
      imageId: url,
      mediaItemId: mediaItemId ?? c.mediaItemId,
      imageAlt:
        alt !== undefined && alt !== null && String(alt).trim() !== ""
          ? String(alt).trim()
          : c.imageAlt ?? "",
    } as BlockShape;
  }

  if (target.field === "imageUrl" && target.itemId == null) {
    if (c.type !== "image") return block;
    return {
      ...c,
      imageId: url,
      mediaItemId: mediaItemId ?? c.mediaItemId,
      alt:
        alt !== undefined && alt !== null && String(alt).trim() !== ""
          ? String(alt).trim()
          : c.alt ?? "",
      caption:
        caption !== undefined && caption !== null && String(caption).trim() !== ""
          ? String(caption).trim()
          : c.caption ?? "",
    } as BlockShape;
  }

  return block;
}

type MediaPickerHookOptions<Block> = {
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void;
};

export function useMediaPicker<Block>({ setBlockById }: MediaPickerHookOptions<Block>) {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<MediaPickerTarget | null>(null);

  const openMediaPicker = useCallback((target: MediaPickerTarget) => {
    setMediaPickerTarget(target);
    setMediaPickerOpen(true);
  }, []);

  const closeMediaPicker = useCallback(() => {
    setMediaPickerOpen(false);
    setMediaPickerTarget(null);
  }, []);

  // Ensure target is cleared whenever modal closes (cancel, overlay click, escape).
  useEffect(() => {
    if (!mediaPickerOpen) setMediaPickerTarget(null);
  }, [mediaPickerOpen]);

  const applyMediaSelection = useCallback(
    (item: MediaSelectionItem) => {
      if (!mediaPickerTarget) return;
      if (!hasValidSelectionUrl(item)) return;
      setBlockById(mediaPickerTarget.blockId, (c: any) =>
        applyMediaSelectionToBlock(c, mediaPickerTarget, item)
      );
      closeMediaPicker();
    },
    [mediaPickerTarget, setBlockById, closeMediaPicker]
  );

  return {
    mediaPickerOpen,
    mediaPickerTarget,
    openMediaPicker,
    closeMediaPicker,
    applyMediaSelection,
  };
}

