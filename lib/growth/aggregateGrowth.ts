import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AbVariantRow } from "@/lib/growth/abAssign";
import { computePerformance } from "@/lib/growth/performance";
import type { VariantScoreRow } from "@/lib/growth/winner";

const ROUTE = "aggregate_growth";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Teller klikk fra ai_activity_log (siste N rader, filtrert i minne). */
async function countClicksForVariant(admin: SupabaseClient, variantId: string): Promise<number> {
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) return 0;
  const { data, error } = await admin
    .from("ai_activity_log")
    .select("metadata")
    .eq("action", "social_click")
    .order("created_at", { ascending: false })
    .limit(8000);
  if (error || !Array.isArray(data)) return 0;
  let n = 0;
  for (const row of data) {
    const m = row && typeof row === "object" ? (row as { metadata?: unknown }).metadata : null;
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    const vid = (m as Record<string, unknown>).variant_id;
    if (typeof vid === "string" && vid === variantId) n += 1;
  }
  return n;
}

async function countLeadsForVariant(admin: SupabaseClient, variantId: string): Promise<number> {
  const ok = await verifyTable(admin, "lead_pipeline", ROUTE);
  if (!ok) return 0;
  const { data, error } = await admin.from("lead_pipeline").select("id, meta").limit(5000);
  if (error || !Array.isArray(data)) return 0;
  let n = 0;
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const meta = (row as { meta?: unknown }).meta;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;
    const av = (meta as Record<string, unknown>).ab_variant_id;
    if (typeof av === "string" && av === variantId) n += 1;
  }
  return n;
}

/** Orders + revenue for a SoMe post (social_post_id + attribution.postId). */
export async function sumOrdersForSocialPost(
  admin: SupabaseClient,
  socialPostId: string
): Promise<{ orders: number; revenue: number }> {
  const ok = await verifyTable(admin, "orders", ROUTE);
  if (!ok) return { orders: 0, revenue: 0 };
  const { data, error } = await admin
    .from("orders")
    .select("line_total, social_post_id, attribution")
    .limit(8000);
  if (error || !Array.isArray(data)) return { orders: 0, revenue: 0 };
  let orders = 0;
  let revenue = 0;
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const sid = typeof o.social_post_id === "string" ? o.social_post_id : "";
    let attrPid = "";
    if (o.attribution && typeof o.attribution === "object" && !Array.isArray(o.attribution)) {
      const p = (o.attribution as Record<string, unknown>).postId;
      if (typeof p === "string") attrPid = p;
    }
    if (sid !== socialPostId && attrPid !== socialPostId) continue;
    orders += 1;
    revenue += num(o.line_total);
  }
  return { orders, revenue };
}

export async function buildVariantScoreRows(admin: SupabaseClient, variants: AbVariantRow[]): Promise<VariantScoreRow[]> {
  const out: VariantScoreRow[] = [];
  for (const v of variants) {
    const [clicks, leads, ord] = await Promise.all([
      countClicksForVariant(admin, v.id),
      countLeadsForVariant(admin, v.id),
      sumOrdersForSocialPost(admin, v.social_post_id),
    ]);
    const funnel = {
      clicks,
      leads,
      orders: ord.orders,
      revenue: ord.revenue,
    };
    const metrics = computePerformance(funnel);
    out.push({
      variantId: v.id,
      label: v.label,
      socialPostId: v.social_post_id,
      metrics,
      funnel,
    });
  }
  return out;
}

export async function loadOrderCountsByPostId(admin: SupabaseClient, postIds: string[]): Promise<Record<string, number>> {
  const ok = await verifyTable(admin, "orders", ROUTE);
  const map: Record<string, number> = {};
  if (!ok || postIds.length === 0) return map;
  const { data, error } = await admin.from("orders").select("social_post_id, attribution").limit(8000);
  if (error || !Array.isArray(data)) return map;
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const sid = typeof o.social_post_id === "string" ? o.social_post_id : "";
    let pid = sid;
    if (!pid && o.attribution && typeof o.attribution === "object" && !Array.isArray(o.attribution)) {
      const p = (o.attribution as Record<string, unknown>).postId;
      if (typeof p === "string") pid = p;
    }
    if (!pid || !postIds.includes(pid)) continue;
    map[pid] = (map[pid] ?? 0) + 1;
  }
  return map;
}
