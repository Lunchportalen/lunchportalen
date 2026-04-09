import type { SocialPostStatus } from "@/lib/social/socialPostStatusCanonical";
import { normalizeSocialPostStatus, statusDisplayKey } from "@/lib/social/socialPostStatusCanonical";
import { normalizePlatform } from "@/lib/social/socialPostContent";

export type SocialPostRowDb = {
  id: string;
  content: unknown;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  platform: string;
  updated_at?: string;
  created_at?: string;
};

export type SocialPostUiModel = {
  id: string;
  status: SocialPostStatus;
  displayGroup: ReturnType<typeof statusDisplayKey>;
  scheduledAt: string | null;
  publishedAt: string | null;
  platform: string;
  caption: string;
  hashtags: string[];
  imageUrl: string | null;
  text: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Leser tekst/hashtags/bilde fra `social_posts.content` (v1 eller eldre flat struktur). */
export function socialPostRowToUi(row: SocialPostRowDb): SocialPostUiModel {
  const c = asRecord(row.content);
  const v = c.v;

  let text = "";
  let hashtags: string[] = [];
  let imageUrl: string | null = null;

  if (v === 1) {
    text = typeof c.text === "string" ? c.text : "";
    hashtags = Array.isArray(c.hashtags) ? (c.hashtags as string[]).filter((x) => typeof x === "string") : [];
    const imgs = Array.isArray(c.images) ? c.images : [];
    imageUrl = typeof imgs[0] === "string" ? imgs[0] : null;
  } else {
    text =
      (typeof c.text === "string" && c.text) ||
      (typeof c.caption === "string" && c.caption) ||
      (typeof c.hook === "string" && c.hook) ||
      "";
    hashtags = Array.isArray(c.hashtags) ? (c.hashtags as string[]).filter((x) => typeof x === "string") : [];
    const img =
      (typeof c.imageUrl === "string" && c.imageUrl) ||
      (Array.isArray(c.images) && typeof c.images[0] === "string" ? (c.images[0] as string) : null);
    imageUrl = img;
  }

  const st = normalizeSocialPostStatus(row.status);

  return {
    id: row.id,
    status: st,
    displayGroup: statusDisplayKey(st),
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    platform: normalizePlatform(row.platform),
    caption: text,
    hashtags,
    imageUrl,
    text,
  };
}
