/**
 * Load recent analytics rows for a CMS page (server-only).
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

import type { CanonicalRevenueEvent } from "./events";
import { normalizeAnalyticsRow, type ContentAnalyticsEventRow } from "./events";

const MAX_ROWS = 15_000;

export async function loadPageRevenueEvents(
  pageId: string,
  hoursBack: number = 168,
): Promise<{ ok: true; events: CanonicalRevenueEvent[] } | { ok: false; message: string }> {
  const pid = typeof pageId === "string" ? pageId.trim() : "";
  if (!pid) return { ok: false, message: "Mangler pageId." };
  const since = new Date(Date.now() - Math.max(1, hoursBack) * 60 * 60 * 1000).toISOString();
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("content_analytics_events")
      .select("id,page_id,variant_id,environment,locale,event_type,event_key,event_value,metadata,created_at")
      .eq("page_id", pid)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS);

    if (error) {
      return { ok: false, message: error.message?.trim() || "Kunne ikke lese analytics." };
    }
    const events: CanonicalRevenueEvent[] = [];
    for (const row of data ?? []) {
      const n = normalizeAnalyticsRow(row as ContentAnalyticsEventRow);
      if (n) events.push(n);
    }
    return { ok: true, events };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ukjent feil.";
    return { ok: false, message: msg };
  }
}
