/**
 * Sammensetting: provider (valgfri) + stemme-metadata + undertekster — alltid trygg fallback.
 */

import "server-only";

import { getVideoProvider } from "@/lib/video/providers";
import { generateCaptions } from "@/lib/video/captions";
import { buildVideoStructure } from "@/lib/video/structure";
import type { VideoScript } from "@/lib/video/script";
import type { VideoStructureBeat } from "@/lib/video/structure";
import { generateVoice, type VoiceGenerationResult } from "@/lib/video/voice";
import type { CaptionCue } from "@/lib/video/captions";
import { renderVideo, type RenderVideoResult } from "@/lib/video/render";

export type ComposedVideoResult = {
  kind: "structure_only" | "provider";
  script: VideoScript;
  structure: VideoStructureBeat[];
  captions: CaptionCue[];
  voice: VoiceGenerationResult;
  providerName: string | null;
  previewUrl: string | null;
  providerMetadata: Record<string, unknown> | null;
  /** Lokal ffmpeg-output (`/generated/video-studio/...`), ellers null. */
  videoUrl: string | null;
  previewFrames: string[];
  localRender: RenderVideoResult["renderMetadata"];
};

export async function composeVideo(input: {
  script: VideoScript;
  media: { images: string[]; videos: string[] };
}): Promise<ComposedVideoResult> {
  const structure = buildVideoStructure(input.script, input.media);
  const voice = await generateVoice(input.script.fullText);
  const captions = generateCaptions(input.script, structure);

  const provider = getVideoProvider();
  let kind: ComposedVideoResult["kind"] = "structure_only";
  let providerName: string | null = null;
  let providerPreviewUrl: string | null = null;
  let providerMetadata: Record<string, unknown> | null = null;

  if (provider) {
    try {
      const raw = await provider.generate({
        script: input.script,
        media: input.media,
        voice,
        captions,
        structure,
      });
      kind = "provider";
      providerName = provider.name;
      providerPreviewUrl =
        typeof raw.previewUrl === "string" && raw.previewUrl.trim().length > 0 ? raw.previewUrl.trim() : null;
      providerMetadata = raw;
    } catch {
      providerMetadata = { error: "provider_failed_fallback" };
    }
  }

  const rendered = await renderVideo(structure, input.media, captions, voice);
  const localVideoUrl = "videoUrl" in rendered && rendered.videoUrl ? rendered.videoUrl : null;
  const previewUrl = localVideoUrl ?? providerPreviewUrl;

  return {
    kind,
    script: input.script,
    structure,
    captions,
    voice,
    providerName,
    previewUrl,
    providerMetadata,
    videoUrl: localVideoUrl,
    previewFrames: rendered.previewFrames,
    localRender: rendered.renderMetadata,
  };
}
