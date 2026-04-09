// DUPLICATE — review

/**
 * AI agents registry: scheduled agents that log and enqueue jobs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { runContentHealthDaily } from "./contentHealthDaily";

async function runSeoAudit(supabase: SupabaseClient): Promise<void> {
  await supabase.from("ai_activity_log").insert(
    buildAiActivityLogRow({
      action: "agent_run",
      page_id: null,
      variant_id: null,
      tool: "seo_audit",
      environment: "preview",
      locale: "nb",
      metadata: { agent: "seo_audit" },
    })
  );
  await supabase.from("ai_jobs").insert({ tool: "seo.optimize.page", status: "pending", input: {}, created_by: "system" });
}
async function runContentDecayScan(supabase: SupabaseClient): Promise<void> {
  await supabase.from("ai_activity_log").insert(
    buildAiActivityLogRow({
      action: "agent_run",
      page_id: null,
      variant_id: null,
      tool: "content_decay",
      environment: "preview",
      locale: "nb",
      metadata: { agent: "content_decay" },
    })
  );
  await supabase.from("ai_jobs").insert({ tool: "content.maintain.page", status: "pending", input: {}, created_by: "system" });
}
async function runExperimentAnalysis(supabase: SupabaseClient): Promise<void> {
  await supabase.from("ai_activity_log").insert(
    buildAiActivityLogRow({
      action: "agent_run",
      page_id: null,
      variant_id: null,
      tool: "experiment_optimizer",
      environment: "preview",
      locale: "nb",
      metadata: { agent: "experiment_optimizer" },
    })
  );
  await supabase.from("ai_jobs").insert({ tool: "seo.optimize.page", status: "pending", input: {}, created_by: "system" });
}
export const AI_AGENTS = {
  seo_audit: { intervalHours: 24, job: runSeoAudit },
  content_decay: { intervalHours: 24, job: runContentDecayScan },
  experiment_optimizer: { intervalHours: 12, job: runExperimentAnalysis },
  content_health_daily: {
    intervalHours: 24,
    job: (sb: SupabaseClient) => runContentHealthDaily(sb, { locale: "nb", limitPages: 200 }),
  },
} as const;
