"use client";

import { BlockLibrary, type BlockLibraryProps } from "./BlockLibrary";

export type BlockPickerOverlayProps = BlockLibraryProps;

export function BlockPickerOverlay(props: BlockPickerOverlayProps) {
  return <BlockLibrary {...props} />;
}

