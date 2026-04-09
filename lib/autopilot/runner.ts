import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "autopilot_runner";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

type VariantRow = { variant_id: string };

async function getExperimentResults(
  experimentId: string,
): Promise<Record<string, { impressions: number; revenue: number }>> {
  const out: Record<string, { impressions: number; revenue: number }> = {};
  if (!hasSupabaseAdminConfig()) return out;
  const admin = supabaseAdmin();
  const ok = await verifyTable(admin, "experiment_events", ROUTE);
  if (!ok) return out;

  const { data: ev } = await admin
    .from("experiment_events")
    .select("variant_id,event_type")
    .eq("experiment_id", experimentId);

  for (const row of ev ?? []) {
    if (!row || typeof row !== "object") continue;
    const vid = String((row as Record<string, unknown>).variant_id ?? "");
    if (!vid) continue;
    const et = String((row as Record<string, unknown>).event_type ?? "");
    if (!out[vid]) out[vid] = { impressions: 0, revenue: 0 };
    if (et === "view" || et === "impression") out[vid]!.impressions += 1;
  }

  const { data: vRows } = await admin.from("experiment_variants").select("variant_id").eq("experiment_id", experimentId);
  const vids = new Set((vRows as VariantRow[] | null)?.map((r) => String(r.variant_id)) ?? []);

  const { data: exp } = await admin.from("experiments").select("content_id,created_at").eq("id", experimentId).maybeSingle();
  const pageId = exp && typeof exp === "object" ? String((exp as Record<string, unknown>).content_id ?? "") : "";
  const sinceIso =
    exp && typeof exp === "object" && typeof (exp as Record<string, unknown>).created_at === "string"
      ? String((exp as Record<string, unknown>).created_at)
      : new Date(0).toISOString();

  if (pageId && vids.size > 0) {
    const { data: orders } = await admin
      .from("orders")
      .select("line_total, attribution")
      .gte("created_at", sinceIso)
      .limit(8000);
    for (const o of orders ?? []) {
      if (!o || typeof o !== "object") continue;
      const attr = (o as Record<string, unknown>).attribution;
      if (!attr || typeof attr !== "object" || Array.isArray(attr)) continue;
      const expId = String((attr as Record<string, unknown>).experimentId ?? "");
      const vid = String((attr as Record<string, unknown>).variantId ?? "");
      if (expId !== experimentId || !vid || !vids.has(vid)) continue;
      if (!out[vid]) out[vid] = { impressions: 0, revenue: 0 };
      out[vid]!.revenue += num((o as Record<string, unknown>).line_total);
    }
  }

  return out;
}

function pickWinner(results: Record<string, { impressions: number; revenue: number }>): string | null {
  const entries = Object.entries(results).filter(([, v]) => v.impressions > 0 || v.revenue > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    const ra = a[1].revenue / Math.max(a[1].impressions, 1);
    const rb = b[1].revenue / Math.max(b[1].impressions, 1);
    if (rb !== ra) return rb - ra;
    return a[0].localeCompare(b[0]);
  });
  return entries[0]![0];
}

/**
 * Evaluates experiment results; **never** writes CMS. Logs reversible audit row with winner.
 * Promotion to prod stays in existing validated pipelines (e.g. backoffice resolve / MOO).
 */
export async function evaluateAndPromote(
  experimentId: string,
  opts?: { rid?: string },
): Promise<{ status: "no_winner" } | { status: "pending_review"; winner: string } | { status: "error"; message: string }> {
  const rid = opts?.rid ?? "autopilot_runner";

  try {
    const results = await getExperimentResults(experimentId);
    const winner = pickWinner(results);
    if (!winner) return { status: "no_winner" };

    if (hasSupabaseAdminConfig()) {
      const admin = supabaseAdmin();
      const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
      if (ok) {
        const row = buildAiActivityLogRow({
          action: "autopilot_promote_candidate",
          metadata: {
            experimentId,
            winner,
            rid,
            results,
            validated: false,
            note: "Autopilot never auto-publishes — apply via standard CMS experiment resolution after review.",
          },
        });
        await admin.from("ai_activity_log").insert({ ...row, rid, status: "success" } as Record<string, unknown>);
      }
    }

    return { status: "pending_review", winner };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "error", message: msg };
  }
}

/**
 * Version hook — **audit only** (reversible). Does not mutate CMS.
 */
export async function createVersionFromExperiment(
  experimentId: string,
  winner: string,
  rid?: string,
): Promise<void> {
  const r = rid ?? "autopilot_version";
  if (!hasSupabaseAdminConfig()) return;
  const admin = supabaseAdmin();
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) return;
  const row = buildAiActivityLogRow({
    action: "autopilot_version_intent",
    metadata: {
      experimentId,
      winner,
      rid: r,
      reversible: true,
      note: "Version record for rollback trace — no CMS body written here.",
    },
  });
  await admin.from("ai_activity_log").insert({ ...row, rid: r, status: "success" } as Record<string, unknown>);
}
