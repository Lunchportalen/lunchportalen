/**
 * Run all registered AI agents.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { AI_AGENTS } from "./registry";

export async function runAgents(): Promise<void> {
  const supabase = supabaseAdmin();
  for (const [key, agent] of Object.entries(AI_AGENTS)) {
    await agent.job(supabase);
    await supabase.from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "agent_run",
        page_id: null,
        variant_id: null,
        tool: key,
        environment: "preview",
        locale: "nb",
        metadata: { agent: key },
      })
    );
  }
}
