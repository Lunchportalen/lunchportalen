/**
 * Phase 43B: Daily content health scan agent. Reads pages from DB, runs analyzeContentHealth, writes content_health.
 * Does NOT modify content tables.
 */

import { analyzeContentHealth } from "@/lib/ai/analysis/contentHealth";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ContentHealthDailyOptions = {
  locale?: string;
  limitPages?: number;
};

function normalizeBlocks(
  raw: unknown
): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(
      (b): b is { id: string; type: string; data?: Record<string, unknown> } =>
        b != null &&
        typeof b === "object" &&
        typeof (b as { id?: unknown }).id === "string" &&
        typeof (b as { type?: unknown }).type === "string"
    )
    .map((b) => ({
      id: String(b.id),
      type: String(b.type),
      data:
        (b as { data?: unknown }).data &&
        typeof (b as { data: unknown }).data === "object" &&
        !Array.isArray((b as { data: unknown }).data)
          ? (b as { data: Record<string, unknown> }).data
          : {},
    }));
}

export async function runContentHealthDaily(
  supabase: any,
  options: ContentHealthDailyOptions = {}
): Promise<{ scanned: number; written: number }> {
  const limitPages = Math.min(200, Math.max(1, options.limitPages ?? 200));

  const { data: variants } = await supabase
    .from("content_page_variants")
    .select("id, page_id")
    .order("created_at", { ascending: false })
    .limit(limitPages);

  const rows = Array.isArray(variants) ? variants : [];
  let written = 0;
  const chunkSize = 50;
  const toInsert: Array<{
    page_id: string | null;
    variant_id: string | null;
    score: number;
    issues: unknown[];
  }> = [];

  for (const row of rows) {
    const pageId = row.page_id ?? null;
    const variantId = row.id ?? null;

    let blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }> = [];
    let meta: { description?: string } | undefined;
    let pageTitle: string | undefined;

    const hasBody =
      row.body != null ||
      (row.payload && typeof row.payload === "object" && (row.payload as Record<string, unknown>).body != null);
    if (hasBody) {
      const body =
        typeof row.body === "string"
          ? row.body
          : (row.payload && typeof row.payload === "object" && typeof (row.payload as Record<string, unknown>).body === "string"
              ? (row.payload as Record<string, unknown>).body
              : null);
      if (body) {
        try {
          const parsed = typeof body === "string" ? JSON.parse(body) : body;
          const rawBlocks = parsed?.blocks ?? parsed?.mainContent ?? parsed;
          blocks = normalizeBlocks(rawBlocks);
          if (parsed?.meta && typeof parsed.meta === "object")
            meta = { description: typeof parsed.meta.description === "string" ? parsed.meta.description : undefined };
          if (typeof parsed?.title === "string") pageTitle = parsed.title;
        } catch {
          blocks = [];
        }
      }
    }

    const { score, issues } = analyzeContentHealth({
      blocks,
      meta,
      pageTitle,
    });

    toInsert.push({
      page_id: pageId,
      variant_id: variantId,
      score,
      issues,
    });
  }

  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error } = await supabase.from("content_health").insert(
      chunk.map((c) => ({
        page_id: c.page_id,
        variant_id: c.variant_id,
        score: c.score,
        issues: c.issues,
      }))
    );
    if (!error) written += chunk.length;
  }

  await supabase.from("ai_activity_log").insert({
    page_id: null,
    variant_id: null,
    environment: "preview",
    locale: options.locale ?? "nb",
    action: "agent_run",
    tool: "content_health_daily",
    metadata: {
      agent: "content_health_daily",
      scanned: rows.length,
      written,
    },
  });

  return { scanned: rows.length, written };
}