import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "get_revenue_by_post";

export type RevenueRowByPost = {
  social_post_id: string | null;
  line_total: number | null;
  id: string;
};

/**
 * Leser ordre med SoMe-kobling for attribusjon/rapporter (additive kolonne social_post_id + jsonb.attribution).
 */
export async function getRevenueByPost(): Promise<{ rows: RevenueRowByPost[] }> {
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "orders", ROUTE);
    if (!ok) return { rows: [] };

    const { data, error } = await admin
      .from("orders")
      .select("id, social_post_id, line_total, attribution")
      .or("social_post_id.not.is.null,attribution.not.is.null")
      .limit(5000);

    if (error) {
      console.error("[getRevenueByPost]", error.message);
      return { rows: [] };
    }

    const rows: RevenueRowByPost[] = [];
    for (const raw of Array.isArray(data) ? data : []) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      if (!id) continue;

      let socialPostId = typeof o.social_post_id === "string" && o.social_post_id.trim() ? o.social_post_id.trim() : null;
      if (!socialPostId && o.attribution && typeof o.attribution === "object" && !Array.isArray(o.attribution)) {
        const pid = (o.attribution as Record<string, unknown>).postId;
        if (typeof pid === "string" && pid.trim()) socialPostId = pid.trim();
      }

      let lineTotal: number | null = null;
      const lt = o.line_total;
      if (typeof lt === "number" && Number.isFinite(lt)) lineTotal = lt;
      else if (typeof lt === "string" && lt.trim()) {
        const n = Number(lt);
        if (Number.isFinite(n)) lineTotal = n;
      }

      rows.push({ id, social_post_id: socialPostId, line_total: lineTotal });
    }

    return { rows };
  } catch (e) {
    console.error("[getRevenueByPost]", e instanceof Error ? e.message : String(e));
    return { rows: [] };
  }
}
