/**
 * AI agents registry: scheduled agents that log and enqueue jobs.
 */
import { runContentHealthDaily } from "./contentHealthDaily";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function runSeoAudit(supabase: any): Promise<void> {
  await supabase.from("ai_activity_log").insert({
    page_id: null, variant_id: null, environment: "preview", locale: "nb",
    action: "agent_run", tool: "seo_audit", metadata: { agent: "seo_audit" },
  });
  await supabase.from("ai_jobs").insert({ tool: "seo.optimize.page", status: "pending", input: {}, created_by: "system" });
}
async function runContentDecayScan(supabase: any): Promise<void> {
  await supabase.from("ai_activity_log").insert({
    page_id: null, variant_id: null, environment: "preview", locale: "nb",
    action: "agent_run", tool: "content_decay", metadata: { agent: "content_decay" },
  });
  await supabase.from("ai_jobs").insert({ tool: "content.maintain.page", status: "pending", input: {}, created_by: "system" });
}
async function runExperimentAnalysis(supabase: any): Promise<void> {
  await supabase.from("ai_activity_log").insert({
    page_id: null, variant_id: null, environment: "preview", locale: "nb",
    action: "agent_run", tool: "experiment_optimizer", metadata: { agent: "experiment_optimizer" },
  });
  await supabase.from("ai_jobs").insert({ tool: "seo.optimize.page", status: "pending", input: {}, created_by: "system" });
}
export const AI_AGENTS = {
  seo_audit: { intervalHours: 24, job: runSeoAudit },
  content_decay: { intervalHours: 24, job: runContentDecayScan },
  experiment_optimizer: { intervalHours: 12, job: runExperimentAnalysis },
  content_health_daily: { intervalHours: 24, job: (sb: any) => runContentHealthDaily(sb, { locale: "nb", limitPages: 200 }) },
} as const;
