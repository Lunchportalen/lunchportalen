import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";
/**
 * Site-wide design (card, surface, spacing, typography, layout) belongs in
 * `global_content.settings.data.designSettings` — use `mergeDesignSettingsIntoGlobalContentData`.
 * This builder only mutates page block structure/copy. AI must not restyle via blocks; patch DesignSettings instead.
 */
import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import { parseBlockConfig } from "@/lib/cms/design/designContract";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

export { CMS_DRAFT_ENVIRONMENT };

const ARRAY_DATA_KEYS = new Set([
  "items",
  "steps",
  "plans",
  "features",
  "cta",
]);

function sanitizePlainObject(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    if (v === null) {
      if (ARRAY_DATA_KEYS.has(k)) {
        out[k] = [];
        continue;
      }
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v
        .map((item) => {
          if (item === undefined || item === null) return null;
          if (item && typeof item === "object" && !Array.isArray(item)) {
            return sanitizePlainObject(item as Record<string, unknown>);
          }
          return item;
        })
        .filter((item) => item !== null && item !== undefined);
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizePlainObject(v as Record<string, unknown>);
      continue;
    }
    out[k] = v;
  }
  return out;
}

function sanitizeBlockNode(b: BlockNode): BlockNode {
  const id = typeof b.id === "string" && b.id.trim() ? b.id.trim() : "block";
  const type = typeof b.type === "string" && b.type.trim() ? b.type.trim() : "richText";
  const raw =
    b.data != null && typeof b.data === "object" && !Array.isArray(b.data)
      ? (b.data as Record<string, unknown>)
      : {};
  const data = sanitizePlainObject(raw);
  const config = parseBlockConfig(b.config);
  return {
    id,
    type,
    data,
    ...(config ? { config } : {}),
  };
}

/**
 * Strips undefined, normalises null arrays, returns a strict BlockList for DB + renderBlock.
 */
export function sanitizeBlockListForPersistence(input: BlockList): BlockList {
  const blocks = input.blocks.map(sanitizeBlockNode);
  let meta: Record<string, unknown> | undefined;
  if (input.meta != null && typeof input.meta === "object" && !Array.isArray(input.meta)) {
    const m = sanitizePlainObject(input.meta as Record<string, unknown>);
    if (Object.keys(m).length > 0) meta = m;
  }
  return {
    version: 1,
    ...(meta ? { meta } : {}),
    blocks,
  };
}

function normalizeIntentLine(intent: string): string {
  return intent.trim().replace(/\s+/g, " ").slice(0, 160);
}

/** Same default as POST /api/backoffice/ai/build-home-from-intent — skip title append when unchanged. */
const DEFAULT_REPO_INTENT = "Firmalunsj med kontroll og forutsigbarhet";

/**
 * Deterministic homepage body from intent: canonical marketing blocks + optional intent line on hero_full.
 * No external AI. Contract: blocks carry `data` (copy/structure) + optional `config` (theme/layout enums only).
 * AI integrations must not emit colors, spacing, or typography in `data` — those keys are stripped at sanitize.
 */
export function buildHomeFromIntentBody(intent: string): BlockList {
  const base = buildMarketingHomeBody();
  const line = normalizeIntentLine(intent);
  const defaultNorm = normalizeIntentLine(DEFAULT_REPO_INTENT);
  const appendIntent = line.length > 0 && line.toLowerCase() !== defaultNorm.toLowerCase();

  const blocks = base.blocks.map((b) => {
    if (b.type === "hero_full" && b.id === "home-hero-full") {
      const data = sanitizePlainObject({
        ...(b.data != null && typeof b.data === "object" && !Array.isArray(b.data)
          ? (b.data as Record<string, unknown>)
          : {}),
      });
      const existingTitle = String(data.title ?? "");
      data.title =
        appendIntent ? `${existingTitle}${existingTitle ? "\n" : ""}${line}` : existingTitle;
      return sanitizeBlockNode({ ...b, data });
    }
    return sanitizeBlockNode(b);
  });
  const metaBase =
    base.meta != null && typeof base.meta === "object" && !Array.isArray(base.meta)
      ? sanitizePlainObject({ ...(base.meta as Record<string, unknown>) })
      : {};
  if (appendIntent) metaBase.aiIntent = line;
  const meta = Object.keys(metaBase).length > 0 ? metaBase : undefined;
  return sanitizeBlockListForPersistence({
    version: 1,
    ...(meta ? { meta } : {}),
    blocks,
  });
}
