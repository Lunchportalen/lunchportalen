/**
 * Samler rådata — ordre er sannhet; best-effort ved manglende tabeller.
 */
import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "collect_revenue_data";
const MAX_POSTS = 5000;
const MAX_ORDERS = 50000;
const MAX_LEADS = 20000;

export type CollectedRevenueData = {
  posts: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  leads: Record<string, unknown>[];
};

export async function collectRevenueData(): Promise<CollectedRevenueData> {
  const empty: CollectedRevenueData = { posts: [], orders: [], leads: [] };
  if (!hasSupabaseAdminConfig()) return empty;

  const admin = supabaseAdmin();

  const postsOk = await verifyTable(admin, "social_posts", ROUTE);
  const ordersOk = await verifyTable(admin, "orders", ROUTE);
  const leadsOk = await verifyTable(admin, "lead_pipeline", ROUTE);

  const posts: Record<string, unknown>[] = [];
  const orders: Record<string, unknown>[] = [];
  const leads: Record<string, unknown>[] = [];

  if (postsOk) {
    const { data, error } = await admin
      .from("social_posts")
      .select("id, content, platform, status")
      .limit(MAX_POSTS);
    if (!error && Array.isArray(data)) posts.push(...(data as Record<string, unknown>[]));
  }

  if (ordersOk) {
    /** `line_total` er fakturert/beløp i skjema — ikke `total_amount`. */
    const { data, error } = await admin
      .from("orders")
      .select("id, line_total, social_post_id, attribution")
      .limit(MAX_ORDERS);
    if (!error && Array.isArray(data)) orders.push(...(data as Record<string, unknown>[]));
  }

  if (leadsOk) {
    const { data, error } = await admin
      .from("lead_pipeline")
      .select("id, source_post_id, contact_email")
      .limit(MAX_LEADS);
    if (!error && Array.isArray(data)) leads.push(...(data as Record<string, unknown>[]));
  }

  return { posts, orders, leads };
}
