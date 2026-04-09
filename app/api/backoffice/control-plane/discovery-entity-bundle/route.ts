/**
 * U20 — Liten discovery-bundle for command palette: faktiske content_pages + media_items.
 * Superadmin-only; samme mønster som øvrige backoffice-API-er. Ingen ny søkemotorplattform.
 */
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse, q } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mediaItemSelectColumns, rowToMediaItem } from "@/lib/media/normalize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;

function serializeError(e: unknown): string {
  if (e instanceof Error) return e.message || e.name || "Error";
  return String(e);
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const limitRaw = q(request, "limit");
  const limit = Math.min(Math.max(parseInt(limitRaw ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  try {
    const supabase = supabaseAdmin();

    const [pagesRes, mediaRes] = await Promise.all([
      supabase
        .from("content_pages")
        .select("id, title, slug, status, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(limit),
      supabase
        .from("media_items")
        .select(mediaItemSelectColumns)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (pagesRes.error) throw pagesRes.error;
    if (mediaRes.error) throw mediaRes.error;

    const contentPages = (pagesRes.data ?? []).map(
      (r: {
        id: string;
        title: string | null;
        slug: string | null;
        status?: string | null;
        updated_at?: string | null;
      }) => ({
        id: r.id,
        title: r.title ?? "",
        slug: r.slug ?? "",
        status: r.status ?? "draft",
        updated_at: r.updated_at ?? null,
      })
    );

    const rawMedia = Array.isArray(mediaRes.data) ? mediaRes.data : [];
    const mediaItems = rawMedia
      .map((row: Record<string, unknown>) => rowToMediaItem(row))
      .filter((item): item is NonNullable<typeof item> => item != null)
      .map((m) => ({
        id: m.id,
        alt: m.alt,
        url: m.url,
        status: m.status,
        source: m.source,
        created_at: m.created_at,
      }));

    return jsonOk(ctx.rid, { contentPages, mediaItems }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, serializeError(e) || "Kunne ikke hente discovery-bundle.", 500, "DISCOVERY_BUNDLE_FAILED", {
      detail: serializeError(e),
    });
  }
}
