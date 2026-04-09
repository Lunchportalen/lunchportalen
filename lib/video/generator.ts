/**
 * Orkestrering: CMS-media + hooks + manus + struktur + komposisjon (adapter, stemme, undertekster).
 */

import "server-only";

import { createHash } from "node:crypto";

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { CalendarPost } from "@/lib/social/calendar";
import { hookTypePerformanceLearning, videoLearningHintsFromPosts } from "@/lib/social/learning";
import { aggregateVideoConversionForAutomation } from "@/lib/social/videoConversionSignals";
import { videoConversionFunnelMetrics } from "@/lib/social/performance";
import { composeVideo, type ComposedVideoResult } from "@/lib/video/composer";
import { generateHook, type VideoHookContext } from "@/lib/video/hooks";
import { generateVideoScript, type VideoScript } from "@/lib/video/script";
import type { VideoStructureBeat } from "@/lib/video/structure";
import { getMediaAssets } from "@/lib/video/media";
import type { CaptionCue } from "@/lib/video/captions";
import type { VoiceGenerationResult } from "@/lib/video/voice";
import { detectDropOff } from "@/lib/video/dropoff";
import {
  selectBestHook,
  type HookPsychologyType,
  type HookRankRow,
} from "@/lib/video/psychology";
import { createVideoVariants } from "@/lib/video/variants";

/** A/B-plan — rekursiv referanse via interface (TypeScript-støttet). */
export interface GeneratedVideoAbVariant {
  id: string;
  hook: string;
  base: GeneratedVideoResult;
}

export interface GeneratedVideoConversion {
  hookRanking: HookRankRow[];
  alternatives: string[];
  selectedHookType: HookPsychologyType;
  selectedHookStrength: number;
  aggregateHookRetentionPct: number | null;
  aggregateCompletionPct: number | null;
  aggregateVideoConversionRatePct: number | null;
  bestHookFromData: string | null;
  worstHookFromData: string | null;
  dropOffDiagnosis: ReturnType<typeof detectDropOff>;
  improvementsSuggested: string[];
  abVariants: GeneratedVideoAbVariant[];
}

export interface GeneratedVideoResult {
  script: VideoScript;
  structure: VideoStructureBeat[];
  hooks: string[];
  selectedHook: string;
  /** Rangert liste — beste først (samme rekkefølge som {@link GeneratedVideoConversion.hookRanking}). */
  alternatives: string[];
  /** Deterministisk ID for A/B-varianter */
  conversionVideoId: string;
  conversion: GeneratedVideoConversion;
  media: { images: string[]; videos: string[] };
  missingAssets: { images: boolean; videos: boolean };
  totalDurationSec: number;
  voice: VoiceGenerationResult;
  captions: CaptionCue[];
  providerStatus: {
    name: string | null;
    used: boolean;
    kind: ComposedVideoResult["kind"];
  };
  /** Avspilling: lokal MP4 og/eller provider-URL (kompatibilitet). */
  previewUrl: string | null;
  /** Kun lokal ffmpeg-output (`/generated/video-studio/...`). */
  videoUrl: string | null;
  previewFrames: string[];
  localRender: ComposedVideoResult["localRender"];
  providerMetadata: Record<string, unknown> | null;
  composed: ComposedVideoResult;
}

export async function generateVideo(
  product: SocialProductRef,
  options?: { calendarPosts?: CalendarPost[]; slotDay?: string },
): Promise<GeneratedVideoResult> {
  const posts = options?.calendarPosts ?? [];
  const hints = videoLearningHintsFromPosts(posts);
  const typeLearn = hookTypePerformanceLearning(posts);
  const ctx: VideoHookContext = {
    slotDay: options?.slotDay,
    preferredHooks: hints.preferredHooks,
    preferredOpenings: hints.preferredOpenings,
  };

  const media = await getMediaAssets(product.id);
  const hooksRaw = generateHook(product, ctx);
  const { selectedHook, alternatives, ranked } = selectBestHook(hooksRaw, {
    boostTypes: typeLearn.bestHookTypes,
    penalizeTypes: typeLearn.worstHookTypes,
  });
  const hooks = ranked.map((r) => r.hook);
  const selectedRow = ranked.find((r) => r.hook === selectedHook);

  const script = generateVideoScript(product, selectedHook, { useConversionCta: true });
  const composed = await composeVideo({ script, media });

  const totalDurationSec = composed.structure.reduce((s, b) => s + b.duration, 0);

  const conversionVideoId = `lpv_${createHash("sha256")
    .update(`${product.id}|${options?.slotDay ?? ""}`)
    .digest("hex")
    .slice(0, 14)}`;

  const agg = aggregateVideoConversionForAutomation(posts);
  let bestHookFromData: string | null = null;
  let worstHookFromData: string | null = null;
  let bestScore = -1;
  let worstScore = 1e9;
  let sumVideoConv = 0;
  let nVideoMetrics = 0;
  for (const p of posts) {
    if (p.status !== "published") continue;
    const m = videoConversionFunnelMetrics(p.performance);
    if (!m || m.videoViews <= 0) continue;
    nVideoMetrics += 1;
    sumVideoConv += m.videoConversionRatePct;
    const hook = (p.hook ?? "").trim();
    if (hook.length >= 6) {
      const s = m.hookRetentionPct + m.videoConversionRatePct;
      if (s > bestScore) {
        bestScore = s;
        bestHookFromData = hook;
      }
      if (s < worstScore) {
        worstScore = s;
        worstHookFromData = hook;
      }
    }
  }

  const aggregateVideoConversionRatePct = nVideoMetrics > 0 ? sumVideoConv / nVideoMetrics : null;

  const dropOffDiagnosis =
    agg && agg.sampleSize >= 2
      ? detectDropOff({ hookRetention: agg.hookRetention, completionRate: agg.completionRate })
      : null;

  const improvementsSuggested: string[] = [];
  if (dropOffDiagnosis === "weak_hook") {
    improvementsSuggested.push(
      "Test flere hooks (pattern interrupt / nysgjerrighet) — dokumentert lav hook-retention.",
    );
  }
  if (dropOffDiagnosis === "weak_story") {
    improvementsSuggested.push("Stram midtdel og kortere CTA-vindu — lav fullføringsrate.");
  }
  if (
    improvementsSuggested.length === 0 &&
    agg &&
    agg.hookRetention >= 55 &&
    agg.completionRate >= 35
  ) {
    improvementsSuggested.push("Behold vinnerformat — vurder å skalere lignende hooks og bilder.");
  }

  const baseResult: GeneratedVideoResult = {
    script: composed.script,
    structure: composed.structure,
    hooks,
    selectedHook,
    alternatives,
    conversionVideoId,
    conversion: {
      hookRanking: ranked,
      alternatives,
      selectedHookType: selectedRow?.type ?? "neutral",
      selectedHookStrength: selectedRow?.strength ?? 0,
      aggregateHookRetentionPct: agg?.hookRetention ?? null,
      aggregateCompletionPct: agg?.completionRate ?? null,
      aggregateVideoConversionRatePct,
      bestHookFromData,
      worstHookFromData,
      dropOffDiagnosis,
      improvementsSuggested,
      abVariants: [],
    },
    media,
    missingAssets: {
      images: media.images.length === 0,
      videos: media.videos.length === 0,
    },
    totalDurationSec,
    voice: composed.voice,
    captions: composed.captions,
    providerStatus: {
      name: composed.providerName,
      used: composed.kind === "provider",
      kind: composed.kind,
    },
    previewUrl: composed.previewUrl,
    videoUrl: composed.videoUrl,
    previewFrames: composed.previewFrames,
    localRender: composed.localRender,
    providerMetadata: composed.providerMetadata,
    composed,
  };

  baseResult.conversion.abVariants = createVideoVariants(baseResult);

  return baseResult;
}
