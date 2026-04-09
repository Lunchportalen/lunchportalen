// STATUS: KEEP

import "server-only";

import { runAutoOptimization } from "@/lib/ai/optimizer";
import { runAIAnalysis } from "@/lib/ai/engine";
import { blockFeatures, primaryCopyPayloadLen } from "@/lib/ai/feedback";
import { logActivity } from "@/lib/ai/logActivity";
import type { ProductVariant } from "@/lib/ai/productVariant";
import { getSurfaceAiControl, parseSurfaceAiControlMap } from "@/lib/ai/surfaceAiGovernance";
import type { CmsSurface } from "@/lib/cms/surfaces";
import { getPublishedGlobal } from "@/lib/cms/readGlobal";
import { makeRid } from "@/lib/http/respond";
import type { AiSuggestionItem, CMSContentInput } from "@/lib/ai/types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function normalizeContent(snapshot: unknown): CMSContentInput {
  if (!isPlainObject(snapshot)) return {};
  return snapshot as CMSContentInput;
}

function collectBlocks(content: CMSContentInput): unknown[] {
  const raw = content.blocks;
  if (Array.isArray(raw)) return raw;
  const nested = content.data;
  if (isPlainObject(nested) && Array.isArray(nested.blocks)) return nested.blocks;
  return [];
}

function toProductVariants(surface: CmsSurface, content: CMSContentInput): ProductVariant[] {
  const blocks = collectBlocks(content);
  const feat = blockFeatures(blocks);
  const primaryLen = primaryCopyPayloadLen(blocks);
  const out: ProductVariant[] = [];
  let i = 0;
  for (const b of blocks) {
    if (!isPlainObject(b)) continue;
    const id = typeof b.id === "string" && b.id.trim() ? b.id.trim() : `block_${i}`;
    const type = String(b.type ?? "unknown");
    out.push({
      surface,
      block_id: id,
      content: JSON.stringify({ type, data: b.data ?? {} }).slice(0, 8000),
      features: {
        ctaCount: feat.ctaCount,
        heroPresent: feat.heroPresent,
        trustHits: feat.trustHits,
        primaryCopyLen: primaryLen,
        tags: [type],
      },
    });
    i++;
    if (out.length >= 40) break;
  }
  return out;
}

export type CmsOptimizeContext = {
  /** Required for full variant generation (tenant-scoped AI runner) */
  companyId?: string;
  userId?: string;
  /** Raw CMS snapshot: `{ blocks: [...] }` or `{ data: { blocks } }` */
  blocksSnapshot?: unknown;
  metrics?: unknown;
};

export type CmsOptimizeResult = {
  rid: string;
  surface: CmsSurface;
  nodeId: string;
  analysisScore: number;
  suggestions: AiSuggestionItem[];
  autoApplyAllowed: false;
  requiresConfirmation: true;
  /** Populated when companyId + userId present */
  optimization?: Awaited<ReturnType<typeof runAutoOptimization>>;
  variants: ProductVariant[];
  policyNote: string;
};

/**
 * Suggest improvements and variants for a CMS node. Never persists or auto-applies.
 * Apply paths must go through recommendation / governance + audit (see policyEngine + recommendationActions).
 */
export async function optimizeCmsContent(
  surface: CmsSurface,
  nodeId: string,
  context: CmsOptimizeContext,
): Promise<CmsOptimizeResult> {
  const rid = makeRid("cms_opt");
  const start = Date.now();
  const content = normalizeContent(context.blocksSnapshot);

  const settingsRow = await getPublishedGlobal("settings");
  const settingsData = settingsRow && isPlainObject(settingsRow.data) ? settingsRow.data : {};
  const control = getSurfaceAiControl(parseSurfaceAiControlMap(settingsData), surface);

  if (!control.ai_optimize_enabled) {
    logActivity({
      rid,
      action: "audit",
      status: "success",
      duration: Date.now() - start,
      metadataExtra: { surface, nodeId, blocked: "surface_disabled" },
    });
    const analysis = await runAIAnalysis(content);
    return {
      rid,
      surface,
      nodeId,
      analysisScore: analysis.score,
      suggestions: analysis.suggestions,
      autoApplyAllowed: false,
      requiresConfirmation: true,
      variants: [],
      policyNote: "AI-optimalisering er skrudd av for denne flaten i superadmin / globale innstillinger.",
    };
  }

  const analysis = await runAIAnalysis(content);
  const companyId = typeof context.companyId === "string" ? context.companyId.trim() : "";
  const userId = typeof context.userId === "string" ? context.userId.trim() : "";

  let optimization: Awaited<ReturnType<typeof runAutoOptimization>> | undefined;
  if (companyId && userId) {
    optimization = await runAutoOptimization(content, { companyId, userId }, context.metrics);
  }

  const variants = toProductVariants(surface, content);

  const policyNote =
    control.auto_apply_requires_superadmin
      ? "Automatisk apply er blokkert uten superadmin-policy og eksplisitt bekreftelse."
      : "Endringer krever manuell eller policy-styrt bekreftelse før apply.";

  logActivity({
    rid,
    action: "audit",
    status: "success",
    duration: Date.now() - start,
    metadataExtra: {
      surface,
      nodeId,
      aggressiveness: control.aggressiveness,
      hasOptimization: Boolean(optimization),
    },
  });

  return {
    rid,
    surface,
    nodeId,
    analysisScore: analysis.score,
    suggestions: analysis.suggestions,
    autoApplyAllowed: false,
    requiresConfirmation: true,
    optimization,
    variants,
    policyNote,
  };
}
