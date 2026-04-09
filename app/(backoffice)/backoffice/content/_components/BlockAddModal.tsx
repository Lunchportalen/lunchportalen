"use client";

import { BlockLibrary } from "./BlockLibrary";

type BlockAddModalProps<TType extends string = string> = {
  open: boolean;
  onClose: () => void;
  onAdd: (type: TType) => void;
  /** null = alle editor-typer; tom array = ingen (U24 allowlist) */
  allowedBlockTypeKeys?: string[] | null;
};

export function BlockAddModal<TType extends string = string>({
  open,
  onClose,
  onAdd,
  allowedBlockTypeKeys = null,
}: BlockAddModalProps<TType>) {
  return (
    <BlockLibrary
      open={open}
      context={{
        pageId: "legacy-add-modal",
        isHome: false,
        docType: null,
        allowedBlockTypeKeys,
      }}
      onClose={onClose}
      onPick={(definition) => {
        onAdd(definition.type as TType);
        onClose();
      }}
    />
  );
}
