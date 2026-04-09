"use client";

// STATUS: KEEP

import { useMemo, useState } from "react";
import { validateModel } from "./blockValidation";

type BlockLike = {
  id: string;
  type: string;
} & Record<string, unknown>;

export type BlockValidationResult = {
  byId: Record<string, string[]>;
  total: number;
  firstId: string | null;
};

export function useBlockValidation(showBlocks: boolean, blocks: BlockLike[]) {
  const [blockValidationError, setBlockValidationError] = useState<string | null>(null);

  const validation: BlockValidationResult = useMemo(() => {
    if (!showBlocks || !blocks.length) {
      return { byId: {}, total: 0, firstId: null };
    }
    return validateModel(
      blocks.map((b) => {
        const { id, type, ...rest } = b;
        return {
          id,
          type,
          data: rest as Record<string, unknown>,
        };
      })
    );
  }, [showBlocks, blocks]);

  const hasBlockingErrors = showBlocks && validation.total > 0;

  return {
    validation,
    hasBlockingErrors,
    blockValidationError,
    setBlockValidationError,
  };
}

