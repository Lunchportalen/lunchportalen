/**
 * Grupperer aggregerte SoMe-rader per variant_group_id (deterministisk rekkefølge).
 */

export type AbVariantStats = {
  id: string;
  clicks: number;
  leads: number;
  score: number;
};

type PostRow = { id: string; variant_group_id?: string | null };
type EventRow = { post_id?: string | null; type?: string | null };

export function groupAbAnalytics(
  posts: PostRow[] | null | undefined,
  events: EventRow[] | null | undefined,
): Record<string, AbVariantStats[]> {
  const pl = [...(Array.isArray(posts) ? posts : [])].sort((a, b) =>
    String(a.id ?? "").localeCompare(String(b.id ?? "")),
  );
  const el = Array.isArray(events) ? events : [];
  const grouped: Record<string, AbVariantStats[]> = {};

  for (const p of pl) {
    const gidRaw = p.variant_group_id;
    const gid = gidRaw != null && String(gidRaw).trim() ? String(gidRaw).trim() : "ungrouped";
    if (!grouped[gid]) grouped[gid] = [];
    const id = String(p.id ?? "");
    const related = el.filter((e) => String(e.post_id ?? "") === id);
    const clicks = related.filter((e) => String(e.type ?? "") === "click").length;
    const leads = related.filter((e) => String(e.type ?? "") === "lead").length;
    grouped[gid].push({ id, clicks, leads, score: leads * 10 + clicks });
  }

  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => a.id.localeCompare(b.id));
  }

  return grouped;
}
