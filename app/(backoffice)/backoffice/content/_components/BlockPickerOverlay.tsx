"use client";

import { BlockLibrary, type BlockLibraryProps } from "./BlockLibrary";

/** Block insert surface — samme som `BlockLibrary` (høyrepanel + tile-grid). */

export type BlockPickerOverlayProps = BlockLibraryProps;

export function BlockPickerOverlay(props: BlockPickerOverlayProps) {
  return <BlockLibrary {...props} />;
}

