/**
 * Public block render (used by {@link CmsBlockRenderer} on the canonical pipeline from
 * `@/lib/cms/public/renderPipeline`).
 */
import React, { type ReactNode } from "react";
import type { ParsedDesignSettings } from "@/lib/cms/design/designContract";
import type { BlockConfig } from "@/lib/cms/model/blockTypes";
import { EnterpriseLockedBlockBridge } from "@/components/blocks/EnterpriseLockedBlockBridge";
import { isEnterpriseRegistryBlockType } from "@/lib/cms/blocks/enterpriseBlockTypes";
import { enforceBlockSafety } from "@/lib/cms/enforceBlockSafety";
import { enforceBlockComponentSafety } from "@/lib/cms/blocks/blockContracts";
import { mergeFullDesign } from "@/lib/cms/design/designContract";
import {
  resolveBlockForEnterpriseRender,
  wrapVisualCanvasPatchForLegacyMigration,
} from "@/lib/cms/blockTypeMap";
import type { UserIntent } from "@/lib/ml/sequence-model";
import { heroCtaForIntent } from "@/lib/personalization/ctaCopy";

type CmsBlock = {
  id: string;
  type: string;
  data?: Record<string, unknown> | null;
  config?: BlockConfig;
};

type Env = "prod" | "staging";

type Locale = "nb" | "en";

/** Backoffice live preview: selected block gets canvas contentEditable (hero_bleed, richText). */
export type VisualCanvasEditOptions = {
  enabled: boolean;
  selectedBlockId: string | null;
  onPatchBlock: (blockId: string, patch: Record<string, unknown>) => void;
};

export type RenderBlockOptions = {
  /** Published global design (`settings.data.designSettings`); block.config.card overrides. */
  designSettings?: ParsedDesignSettings | null;
  visualCanvasEdit?: VisualCanvasEditOptions | null;
  /** Opt-in hero CTA copy from intent (default path unchanged when omitted/disabled). */
  personalization?: { enabled?: boolean; intent?: UserIntent } | null;
};

export { normalizeDisplayText } from "@/lib/cms/displayText";

export function renderBlock(
  block: CmsBlock,
  env: Env,
  locale: Locale,
  options?: RenderBlockOptions | null,
): ReactNode {
  if (!block) return null;
  const ds = options?.designSettings ?? null;
  const vce = options?.visualCanvasEdit;
  const visualBase =
    vce?.enabled && vce.selectedBlockId === block.id ?
      { onPatch: (patch: Record<string, unknown>) => vce.onPatchBlock(block.id, patch) }
    : null;

  const { originalType, registryType, data: registryData } = resolveBlockForEnterpriseRender(block);

  if (!isEnterpriseRegistryBlockType(registryType)) {
    return null;
  }

  const merged = mergeFullDesign(block.config, ds, registryType);
  const safeData: Record<string, unknown> = { ...registryData };
  enforceBlockComponentSafety(registryType, safeData);
  enforceBlockSafety(registryType, safeData);

  const pe = options?.personalization;
  if (pe?.enabled === true && registryType === "hero_bleed") {
    const intent = pe.intent ?? "low_intent";
    const cta = heroCtaForIntent(intent);
    safeData.ctaPrimary = cta;
    safeData.ctaLabel = cta;
  }
  const visualForBridge = wrapVisualCanvasPatchForLegacyMigration(
    originalType,
    registryType,
    visualBase,
  );

  return (
    <EnterpriseLockedBlockBridge
      block={{ ...block, type: registryType, data: safeData }}
      merged={merged}
      designSettings={ds}
      visualCanvasEdit={visualForBridge}
      env={env}
      locale={locale}
    />
  );
}
