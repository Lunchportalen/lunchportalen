import "server-only";

import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import { generateCopyVariant } from "@/lib/experiment/generateCopyVariant";
import type { MvoVariant } from "./types";

export type PostWithTextContent = {
  content?: { text?: string; [k: string]: unknown };
  [k: string]: unknown;
};

/**
 * AI kun for tekstgenerering; variant-dimensjoner er allerede valgt deterministisk.
 */
export async function applyVariant(
  post: PostWithTextContent,
  variant: MvoVariant,
  ctx: EditorTextRunContext
): Promise<PostWithTextContent & { variant: MvoVariant }> {
  const raw = typeof post.content?.text === "string" ? post.content.text : "";
  const hypothesis = {
    type: "observe" as const,
    hypothesis: `Optimize for ${variant.segment} (channel=${variant.channel}, timing=${variant.timing})`,
  };
  const content =
    raw.trim().length > 0
      ? await generateCopyVariant(raw, hypothesis, ctx)
      : raw;

  return {
    ...post,
    variant,
    content: {
      ...(typeof post.content === "object" && post.content ? post.content : {}),
      text: content || raw,
      variant,
    },
  };
}
