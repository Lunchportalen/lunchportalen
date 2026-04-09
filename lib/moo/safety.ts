import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getHighTrafficPageViewThreshold } from "@/lib/moo/mooConfig";
import { countPageViewsLastDays } from "@/lib/moo/pageTraffic";

const COOLDOWN_HIGH_TRAFFIC_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_LOW_TRAFFIC_MS = 60 * 60 * 1000;

/** Slugs that always use the long cooldown (protect critical surfaces). */
function highRiskSlugsFromEnv(): Set<string> {
  const raw = typeof process.env.LP_MOO_HIGH_RISK_SLUGS === "string" ? process.env.LP_MOO_HIGH_RISK_SLUGS : "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const base = new Set(["home", "global"]);
  for (const s of fromEnv) base.add(s);
  return base;
}

/**
 * MOO resolve runs at most one running experiment per cron invocation.
 */
export function assertSingleRunningExperiment(running: { id: string }[] | null | undefined): { ok: true; id: string } | { ok: false; reason: string } {
  const list = Array.isArray(running) ? running : [];
  if (list.length === 0) return { ok: false, reason: "no_running" };
  if (list.length > 1) return { ok: false, reason: "multiple_running" };
  const id = String(list[0]?.id ?? "").trim();
  if (!id) return { ok: false, reason: "invalid_id" };
  return { ok: true, id };
}

/**
 * Fails closed if the last completed experiment for this page was resolved within the cooldown window.
 * High-traffic pages (7d prod page_views ≥ threshold) → 24h; low-traffic → 1h. Critical slugs always 24h.
 */
export async function isMooCooldownActive(
  supabase: SupabaseClient,
  pageId: string,
  nowMs: number,
): Promise<boolean> {
  const pid = String(pageId ?? "").trim();
  if (!pid) return true;

  let slug = "";
  try {
    const { data: page } = await supabase.from("content_pages").select("slug").eq("id", pid).maybeSingle();
    slug = typeof (page as { slug?: string } | null)?.slug === "string" ? String((page as { slug: string }).slug).trim().toLowerCase() : "";
  } catch {
    slug = "";
  }

  const highRisk = highRiskSlugsFromEnv();
  const views7d = await countPageViewsLastDays(supabase, pid, 7);
  const threshold = getHighTrafficPageViewThreshold();
  const cooldownMs =
    slug && highRisk.has(slug)
      ? COOLDOWN_HIGH_TRAFFIC_MS
      : views7d >= threshold
        ? COOLDOWN_HIGH_TRAFFIC_MS
        : COOLDOWN_LOW_TRAFFIC_MS;

  const { data, error } = await supabase
    .from("experiments")
    .select("resolution_meta")
    .eq("content_id", pid)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return true;
  const meta = data?.resolution_meta as { lastResolution?: { resolvedAt?: string } } | null | undefined;
  const ra = meta?.lastResolution?.resolvedAt;
  if (typeof ra !== "string" || !ra.trim()) return false;
  const t = Date.parse(ra);
  if (!Number.isFinite(t)) return false;
  return nowMs - t < cooldownMs;
}
