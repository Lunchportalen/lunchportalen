import type { ReactNode } from "react";

import type { BlockItem } from "@/lib/cms/public/parseBody";
import { buildEffectiveParsedDesignSettingsLayered } from "@/lib/cms/design/designContract";
import { getGlobalSettingsDataRoot } from "@/lib/cms/design/getDesignSettings";
import { resolveMediaInNormalizedBlocks } from "@/lib/cms/media/resolveBlockMediaDeep";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import { renderBlock } from "@/lib/public/blocks/renderBlock";
import { HomePricingSection } from "@/components/cms/HomePricingSection";

type Env = "prod" | "staging";
type Locale = "nb" | "en";

export type CmsBlockRendererProps = {
  blocks: BlockItem[];
  env: Env;
  locale: Locale;
  /** When true, empty `pricing` blocks use live product-plan data (server only). */
  enableLivePricing?: boolean;
  /** Per-block wrapper class for vertical rhythm (homepage). */
  blockWrapperClassName?: string;
  /** From saved body `meta` — `pageDesign` / `sectionDesign` (global → page → section → block). */
  pageCmsMeta?: Record<string, unknown> | null;
};

function pricingPlansFromData(data: Record<string, unknown>): unknown[] {
  const plans = data.plans;
  return Array.isArray(plans) ? plans : [];
}

/**
 * Server component: maps CMS blocks to public render output.
 * Empty `pricing` blocks optionally resolve via {@link HomePricingSection} (live plans).
 */
export async function CmsBlockRenderer({
  blocks,
  env,
  locale,
  enableLivePricing = false,
  blockWrapperClassName = "lp-cms-block",
  pageCmsMeta = null,
}: CmsBlockRendererProps) {
  const safe = Array.isArray(blocks) ? blocks : [];
  const globalDataRoot = await getGlobalSettingsDataRoot();
  const pageMeta = pageCmsMeta && typeof pageCmsMeta === "object" && !Array.isArray(pageCmsMeta) ? pageCmsMeta : null;
  const normalized = safe.map((raw, i) => normalizeBlockForRender(raw ?? null, i));
  const nodes = await resolveMediaInNormalizedBlocks(normalized);
  const out: ReactNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const data = (node.data ?? {}) as Record<string, unknown>;
    const designSettings = buildEffectiveParsedDesignSettingsLayered(
      globalDataRoot,
      pageMeta,
      node.config?.sectionId ?? null,
    );

    if (node.type === "pricing" && enableLivePricing && pricingPlansFromData(data).length === 0) {
      const title = typeof data.title === "string" ? data.title : undefined;
      const intro =
        typeof data.intro === "string" ?
          data.intro
        : typeof data.subtitle === "string" ?
          data.subtitle
        : undefined;
      out.push(
        <div key={node.id} className={blockWrapperClassName}>
          <HomePricingSection title={title} intro={intro} designSettings={designSettings} />
        </div>,
      );
      continue;
    }

    out.push(
      <div key={node.id} className={blockWrapperClassName}>
        {renderBlock(node, env, locale, { designSettings })}
      </div>,
    );
  }

  // Vertical rhythm: each block owns `lp-section` / `lp-hero` — no extra flex gap (avoids double padding).
  return <div className="flex w-full flex-col">{out}</div>;
}
