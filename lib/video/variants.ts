/**
 * A/B-forberedelse: én plan per hook-variant (samme base-pakke).
 */

export type VideoVariantBase = {
  hooks: string[];
  conversionVideoId: string;
};

export type VideoVariantPlan<T extends VideoVariantBase = VideoVariantBase> = {
  id: string;
  hook: string;
  base: T;
};

/**
 * Bygger variant-ID-er deterministisk fra `conversionVideoId` + indeks.
 */
export function createVideoVariants<T extends VideoVariantBase>(video: T): VideoVariantPlan<T>[] {
  return video.hooks.map((hook, i) => ({
    id: `${video.conversionVideoId}_v${i}`,
    hook,
    base: video,
  }));
}
