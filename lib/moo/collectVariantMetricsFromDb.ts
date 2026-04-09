import "server-only";

import type { MooLogRow, MooOrderRow, MooSessionRow } from "@/lib/moo/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CollectVariantMetricsInput = {
  experimentId: string;
  variantId: string;
  pageId: string;
  sinceIso: string;
};

export type CollectVariantMetricsResult = {
  orders: MooOrderRow[];
  sessions: MooSessionRow[];
  logs: MooLogRow[];
};

function countImpressions(eventType: string): boolean {
  return eventType === "view" || eventType === "impression";
}

/**
 * Real metrics for one experiment variant: revenue rows, sessions, dwell proxy from analytics + experiment events.
 */
export async function collectVariantMetricsFromDb(input: CollectVariantMetricsInput): Promise<CollectVariantMetricsResult> {
  const supabase = supabaseAdmin();
  const { experimentId, variantId, pageId, sinceIso } = input;

  const { data: revRows } = await supabase
    .from("experiment_revenue")
    .select("revenue")
    .eq("experiment_id", experimentId)
    .eq("variant_id", variantId)
    .gte("created_at", sinceIso);

  const orders: MooOrderRow[] = (revRows ?? []).map((r) => {
    const rev = (r as { revenue?: unknown }).revenue;
    const total_amount: number | string =
      typeof rev === "number" || typeof rev === "string" ? rev : 0;
    return { total_amount };
  });

  const { data: sessRows } = await supabase
    .from("experiment_sessions")
    .select("session_id")
    .eq("experiment_id", experimentId)
    .eq("variant_id", variantId)
    .gte("created_at", sinceIso);

  const sessions: MooSessionRow[] = (sessRows ?? []).map((r) => ({
    user_id: null,
    session_id: String((r as { session_id?: string }).session_id ?? ""),
  }));

  const { data: evRows } = await supabase
    .from("experiment_events")
    .select("event_type")
    .eq("experiment_id", experimentId)
    .eq("variant_id", variantId)
    .gte("created_at", sinceIso);

  let impressions = 0;
  for (const raw of evRows ?? []) {
    const et = String((raw as { event_type?: string }).event_type ?? "");
    if (countImpressions(et)) impressions += 1;
  }

  const { data: caRows } = await supabase
    .from("content_analytics_events")
    .select("metadata,event_type,created_at")
    .eq("page_id", pageId)
    .eq("event_type", "page_view")
    .gte("created_at", sinceIso);

  let totalDwell = 0;
  let caCount = 0;
  for (const raw of caRows ?? []) {
    const meta = (raw as { metadata?: unknown }).metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const d = (meta as Record<string, unknown>).duration;
      if (typeof d === "number" && Number.isFinite(d)) {
        totalDwell += d;
        caCount += 1;
      }
    }
  }

  const { data: evAll } = await supabase
    .from("experiment_events")
    .select("event_type,variant_id")
    .eq("experiment_id", experimentId)
    .gte("created_at", sinceIso);

  let impA = 0;
  let impB = 0;
  for (const raw of evAll ?? []) {
    const et = String((raw as { event_type?: string }).event_type ?? "");
    const vid = String((raw as { variant_id?: string }).variant_id ?? "");
    if (!countImpressions(et)) continue;
    if (vid === "A") impA += 1;
    else if (vid === "B") impB += 1;
  }
  const impTotal = impA + impB;
  const share = impTotal > 0 && (variantId === "A" || variantId === "B") ? (variantId === "A" ? impA : impB) / impTotal : 0.5;

  const pageMeanDwell = caCount > 0 ? totalDwell / caCount : 0;
  const allocatedDwell = pageMeanDwell * (impTotal > 0 ? share : 1);
  const perEventDwell = impressions > 0 ? allocatedDwell / impressions : allocatedDwell;

  const logs: MooLogRow[] = [];
  for (let i = 0; i < Math.max(impressions, 1); i++) {
    logs.push({ action: "page_view", metadata: { duration: perEventDwell } });
  }

  return { orders, sessions, logs };
}
