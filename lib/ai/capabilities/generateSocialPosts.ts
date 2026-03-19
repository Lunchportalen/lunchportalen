/**
 * Social media content generator capability: generateSocialPosts.
 * Produces social post copy and specs per platform from topic, message, CTA, and link.
 * Deterministic; no LLM. Output for LinkedIn, Facebook, X/Twitter, Instagram.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateSocialPosts";

const generateSocialPostsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates social media post copy per platform from topic, key message, CTA, and link. Returns platform-specific copy, character limits, hashtags, and best-practice hints. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Social posts generation input",
    properties: {
      topic: { type: "string", description: "Post topic or theme" },
      keyMessage: { type: "string", description: "Main message to convey" },
      platforms: {
        type: "array",
        items: { type: "string", enum: ["linkedin", "facebook", "twitter", "instagram"] },
        description: "Platforms to generate for",
      },
      tone: {
        type: "string",
        enum: ["professional", "friendly", "casual"],
        description: "Tone of voice",
      },
      cta: { type: "string", description: "Call to action (e.g. Learn more, Les mer)" },
      linkUrl: { type: "string", description: "Optional link to include" },
      hashtagSeed: { type: "array", items: { type: "string" }, description: "Optional hashtags to include" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["topic"],
  },
  outputSchema: {
    type: "object",
    description: "Generated social posts",
    required: ["posts", "styleNotes", "generatedAt"],
    properties: {
      posts: {
        type: "array",
        items: {
          type: "object",
          required: ["platform", "copy", "maxLength", "hashtags", "bestPractices"],
          properties: {
            platform: { type: "string" },
            copy: { type: "string" },
            copyShort: { type: "string", description: "Truncated for strict limits if needed" },
            maxLength: { type: "number" },
            hashtags: { type: "array", items: { type: "string" } },
            bestPractices: { type: "array", items: { type: "string" } },
          },
        },
      },
      styleNotes: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is copy/spec only; no publishing or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateSocialPostsCapability);

const PLATFORM_LIMITS: Record<string, number> = {
  linkedin: 3000,
  facebook: 63206,
  twitter: 280,
  instagram: 2200,
};

const PLATFORM_BEST_PRACTICES: Record<string, string[]> = {
  linkedin: ["Professional tone", "First line visible in feed – hook there", "1–3 hashtags"],
  facebook: ["Short paragraph or bullet points", "Question or CTA in first line", "Link in first comment optional"],
  twitter: ["Concise; use thread if longer", "1–2 hashtags", "Leave room for retweet with comment"],
  instagram: ["Caption can be longer; first line in preview", "3–5 hashtags", "Emoji sparingly if on-brand"],
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

function truncate(s: string, max: number, suffix = "…"): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - suffix.length);
  const last = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("."));
  if (last > max * 0.5) return cut.slice(0, last).trim() + suffix;
  return cut.trim() + suffix;
}

export type GenerateSocialPostsInput = {
  topic: string;
  keyMessage?: string | null;
  platforms?: ("linkedin" | "facebook" | "twitter" | "instagram")[] | null;
  tone?: "professional" | "friendly" | "casual" | null;
  cta?: string | null;
  linkUrl?: string | null;
  hashtagSeed?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type SocialPostOutput = {
  platform: string;
  copy: string;
  copyShort?: string;
  maxLength: number;
  hashtags: string[];
  bestPractices: string[];
};

export type GenerateSocialPostsOutput = {
  posts: SocialPostOutput[];
  styleNotes: string[];
  summary?: string;
  generatedAt: string;
};

/**
 * Generates social post copy per platform. Deterministic; no external calls.
 */
export function generateSocialPosts(input: GenerateSocialPostsInput): GenerateSocialPostsOutput {
  const isEn = input.locale === "en";
  const topic = safeStr(input.topic);
  const keyMessage = safeStr(input.keyMessage);
  const cta = safeStr(input.cta) || (isEn ? "Learn more" : "Les mer");
  const linkUrl = safeStr(input.linkUrl);
  const platforms = Array.isArray(input.platforms) && input.platforms.length > 0
    ? input.platforms.filter((p) => ["linkedin", "facebook", "twitter", "instagram"].includes(p))
    : (["linkedin", "facebook", "twitter"] as const);

  const parts: string[] = [];
  if (topic) parts.push(topic);
  if (keyMessage) parts.push(keyMessage);
  const body = parts.join(". ") || (isEn ? "Update" : "Oppdatering");
  const withCta = linkUrl ? `${body} ${cta}: ${linkUrl}` : `${body} ${cta}.`;

  const hashtagSeed = Array.isArray(input.hashtagSeed) ? input.hashtagSeed.map((h) => (typeof h === "string" ? h.trim().replace(/^#/, "") : "")).filter(Boolean) : [];
  const topicTags = topic ? [topic.replace(/\s+/g, "").slice(0, 20)] : [];
  const hashtags = [...new Set([...hashtagSeed, ...topicTags])].slice(0, 5).map((h) => (h.startsWith("#") ? h : `#${h}`));

  const posts: SocialPostOutput[] = [];

  for (const platform of platforms) {
    const maxLen = PLATFORM_LIMITS[platform] ?? 500;
    const copy = withCta.length <= maxLen ? withCta : truncate(withCta, maxLen);
    const copyShort = platform === "twitter" && withCta.length > 280 ? truncate(withCta, 280) : undefined;
    const bestPractices = PLATFORM_BEST_PRACTICES[platform] ?? [];

    posts.push({
      platform,
      copy,
      ...(copyShort ? { copyShort } : {}),
      maxLength: maxLen,
      hashtags,
      bestPractices,
    });
  }

  const styleNotes: string[] = [];
  if (input.tone === "professional") styleNotes.push(isEn ? "Keep tone calm and professional (AGENTS.md)." : "Behold rolig og profesjonell tone (AGENTS.md).");
  if (input.tone === "friendly") styleNotes.push(isEn ? "Warm, approachable; no hype." : "Varm og tilgjengelig; ingen hype.");

  const summary = isEn
    ? `${posts.length} post(s) for ${platforms.join(", ")}. Topic: ${topic || "—"}.`
    : `${posts.length} post(er) for ${platforms.join(", ")}. Tema: ${topic || "—"}.`;

  return {
    posts,
    styleNotes,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateSocialPostsCapability, CAPABILITY_NAME };
