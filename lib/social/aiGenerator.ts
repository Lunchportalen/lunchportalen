import type { SocialDbAnalyticsRow } from "@/lib/social/analyticsAggregate";

/** Rad klar for deterministisk «kloning» av toppytelse. */
export type PostWithSourceText = SocialDbAnalyticsRow & {
  /** Tekst utledet fra lagret innhold (jsonb / felt). */
  sourceText: string;
};

function sourceTextFromStoredContent(content: unknown): string {
  if (content == null) return "";
  let obj: Record<string, unknown> | null = null;
  if (typeof content === "string") {
    try {
      const p = JSON.parse(content) as unknown;
      obj = p && typeof p === "object" ? (p as Record<string, unknown>) : null;
    } catch {
      return content.trim().slice(0, 2000);
    }
  } else if (typeof content === "object") {
    obj = content as Record<string, unknown>;
  }
  if (!obj) return "";
  const hook = typeof obj.hook === "string" ? obj.hook.trim() : "";
  const caption = typeof obj.caption === "string" ? obj.caption.trim() : "";
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  const nested = obj.content;
  let nestedText = "";
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nc = nested as Record<string, unknown>;
    nestedText =
      (typeof nc.text === "string" ? nc.text.trim() : "") ||
      (typeof nc.caption === "string" ? nc.caption.trim() : "") ||
      "";
  }
  const combined = [hook, caption, text, nestedText].filter(Boolean).join("\n\n");
  return combined.trim();
}

/**
 * Kobler aggregerte rader med `social_posts.content` (jsonb) — deterministisk tekstuttrekk.
 */
export function attachSourceTextToAnalytics(
  analyticsRows: SocialDbAnalyticsRow[],
  dbPosts: Array<{ id: string; content?: unknown }>,
): PostWithSourceText[] {
  const byId = new Map(dbPosts.map((p) => [String(p.id), p]));
  return analyticsRows.map((row) => {
    const raw = byId.get(row.id);
    return {
      ...row,
      sourceText: sourceTextFromStoredContent(raw?.content),
    };
  });
}

export type GeneratedVariant = {
  title: string;
  content: string;
  strategy: "high_performer_clone";
  postId: string;
};

/**
 * Topp 3 etter score (tie-break: id). Ingen eksterne modeller.
 */
export function generateFromTopPosts(posts: PostWithSourceText[]): GeneratedVariant[] {
  const top = [...posts]
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id)))
    .slice(0, 3);

  return top.map((p, i) => ({
    title: `Variant ${i + 1}`,
    content: p.sourceText.trim() || "Ny variant basert på det som fungerer",
    strategy: "high_performer_clone",
    postId: p.id,
  }));
}
