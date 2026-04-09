import { buildStandardSocialContentV1, normalizePlatform, type SocialContentSource } from "@/lib/social/socialPostContent";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export type MergeSocialContentPatch = {
  text?: string;
  hashtags?: string[];
  imageUrl?: string | null;
  platform?: string;
  source?: SocialContentSource;
};

/**
 * Oppdaterer `social_posts.content` til v1-kontrakt der mulig (ingen ny tabell).
 */
export function mergeSocialPostContent(existing: unknown, patch: MergeSocialContentPatch): Record<string, unknown> {
  const ex = asRecord(existing);
  const v = ex.v;

  const prevText =
    v === 1 && typeof ex.text === "string"
      ? ex.text
      : typeof ex.text === "string"
        ? ex.text
        : typeof ex.caption === "string"
          ? ex.caption
          : typeof ex.hook === "string"
            ? ex.hook
            : "";

  const prevTags =
    v === 1 && Array.isArray(ex.hashtags)
      ? (ex.hashtags as string[])
      : Array.isArray(ex.hashtags)
        ? (ex.hashtags as string[])
        : [];

  const prevImages =
    v === 1 && Array.isArray(ex.images)
      ? (ex.images as string[])
      : typeof ex.imageUrl === "string"
        ? [ex.imageUrl]
        : [];

  const text = patch.text !== undefined ? patch.text : prevText;
  const hashtags = patch.hashtags !== undefined ? patch.hashtags : prevTags;

  let images: string[];
  if (patch.imageUrl === undefined) {
    images = prevImages.length ? prevImages : [];
  } else if (patch.imageUrl === null || patch.imageUrl === "") {
    images = [];
  } else {
    images = [patch.imageUrl];
  }

  const platform = normalizePlatform(patch.platform ?? ex.platform ?? "linkedin");
  const source: SocialContentSource =
    patch.source ?? (v === 1 && ex.source === "ai" ? "ai" : v === 1 && ex.source === "deterministic" ? "deterministic" : "fallback");

  const data =
    v === 1 && ex.data && typeof ex.data === "object"
      ? (ex.data as Record<string, unknown>)
      : {
          calendarPostId: typeof ex.calendarPostId === "string" ? ex.calendarPostId : undefined,
          revenueTrackingPath: ex.revenueTrackingPath ?? null,
          link: ex.link ?? null,
          productId: typeof ex.productId === "string" ? ex.productId : undefined,
        };

  const built = buildStandardSocialContentV1({
    text,
    hashtags,
    images,
    source,
    platform,
    data: {
      calendarPostId: typeof data.calendarPostId === "string" ? data.calendarPostId : undefined,
      revenueTrackingPath: (data.revenueTrackingPath as string | null | undefined) ?? null,
      link: (data.link as string | null | undefined) ?? null,
      productId: typeof data.productId === "string" ? data.productId : undefined,
    },
  });

  return { ...built, data: built.data } as unknown as Record<string, unknown>;
}
