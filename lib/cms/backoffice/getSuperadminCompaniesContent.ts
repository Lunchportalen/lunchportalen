import "server-only";

import { readSupabasePublishedContentPageBySlug } from "@/lib/cms/supabase/readPublishedContentPageBySlug";

export type SuperadminCompaniesCmsCopy = {
  title: string | null;
  intro: string | null;
  searchPlaceholder: string | null;
  emptyStateTitle: string | null;
  emptyStateText: string | null;
};

const SLUG = "superadmin-companies";

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t ? t : null;
}

function readUiMeta(body: unknown): Record<string, unknown> {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return {};
  const root = body as Record<string, unknown>;
  const meta = root.meta;
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return {};
  const ui = (meta as Record<string, unknown>).ui;
  if (ui == null || typeof ui !== "object" || Array.isArray(ui)) return {};
  return ui as Record<string, unknown>;
}

/**
 * Presentation-only CMS bridge for `/superadmin/companies`.
 *
 * Reads:
 * - `content_pages.title` → title
 * - `content_page_variants.body.meta.ui` → { intro, searchPlaceholder, emptyStateTitle, emptyStateText }
 *
 * Returns null when content is missing. Callers must apply deterministic defaults.
 */
export async function getSuperadminCompaniesCmsCopy(): Promise<SuperadminCompaniesCmsCopy | null> {
  const content = await readSupabasePublishedContentPageBySlug(SLUG);
  if (!content) return null;

  const ui = readUiMeta(content.body);

  return {
    title: safeStr(content.title),
    intro: safeStr(ui.intro),
    searchPlaceholder: safeStr(ui.searchPlaceholder),
    emptyStateTitle: safeStr(ui.emptyStateTitle),
    emptyStateText: safeStr(ui.emptyStateText),
  };
}

