/**
 * Run all registered AI agents.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AI_AGENTS } from "./registry";

export async function runAgents(): Promise<void> {
  const supabase = supabaseAdmin();
  for (const [key, agent] of Object.entries(AI_AGENTS)) {
    await agent.job(supabase);
    await supabase.from("ai_activity_log").insert({
      page_id: null, variant_id: null, environment: "preview", locale: "nb",
      action: "agent_run", tool: key, metadata: { agent: key },
    });
  }
}
