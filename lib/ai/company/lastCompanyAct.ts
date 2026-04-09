/**
 * Cooldown anchor for company control tower (best-effort read from ai_activity_log).
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const ACTIONS = ["company_control_tower_act", "company_control_tower_execute"] as const;

export async function fetchLastCompanyControlActAt(): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("ai_activity_log")
      .select("created_at")
      .in("action", [...ACTIONS])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as { created_at?: string | null };
    const raw = row.created_at;
    if (typeof raw !== "string" || !raw) return null;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}
