/**
 * Video-leverandør-adapter — byttbar; tom liste = trygg fallback (kun struktur).
 */

import type { VideoScript } from "@/lib/video/script";
import type { VideoStructureBeat } from "@/lib/video/structure";
import type { VoiceGenerationResult } from "@/lib/video/voice";
import type { CaptionCue } from "@/lib/video/captions";

export type VideoProviderInput = {
  script: VideoScript;
  media: { images: string[]; videos: string[] };
  voice: VoiceGenerationResult;
  captions: CaptionCue[];
  structure: VideoStructureBeat[];
};

/** Fremtid: Runway, Pika, Sora, … — registreres her uten å endre motor. */
export type VideoProvider = {
  name: string;
  generate: (input: VideoProviderInput) => Promise<Record<string, unknown>>;
};

export const providers: VideoProvider[] = [];

export function getVideoProvider(): VideoProvider | null {
  return providers[0] ?? null;
}

/** Registrer leverandør (f.eks. ved app-init). Første registrerte brukes av {@link getVideoProvider}. */
export function registerVideoStudioProvider(provider: VideoProvider): void {
  providers.push(provider);
}
