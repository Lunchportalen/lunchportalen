"use client";

import React from "react";
import type { ParsedDesignSettings } from "@/lib/cms/design/designContract";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import type { BlockConfig } from "@/lib/cms/model/blockTypes";
import type { VisualCanvasPatchHandler } from "@/lib/cms/blockTypeMap";
import { EnterpriseLockedBlockView } from "./EnterpriseLockedBlockView";

export type EnterpriseLockedBlockBridgeProps = {
  block: { id: string; type: string; data?: Record<string, unknown> | null; config?: BlockConfig };
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  /** Backoffice preview: forwarded to hero_bleed / text_block / rich_text. */
  visualCanvasEdit?: VisualCanvasPatchHandler | null;
  /** Public render: skjema + pris-forhåndsvisning. */
  env?: "prod" | "staging";
  locale?: "nb" | "en";
};

/**
 * Client bridge: all registry `block.type` values render through {@link EnterpriseLockedBlockView}.
 */
export function EnterpriseLockedBlockBridge({
  block,
  merged,
  designSettings,
  visualCanvasEdit = null,
  env = "prod",
  locale = "nb",
}: EnterpriseLockedBlockBridgeProps) {
  return (
    <EnterpriseLockedBlockView
      block={block}
      merged={merged}
      designSettings={designSettings}
      visualCanvasEdit={visualCanvasEdit}
      renderEnv={env}
      renderLocale={locale}
    />
  );
}
